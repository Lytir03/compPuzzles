import { createServer } from "node:http";
import { prisma } from "@/database/client";
import { DisconnectStatus, MatchStatus } from "@/database/generated/client/enums";
import { RateLimiter, REALTIME_RATE_LIMITS } from "@/lib/rateLimit";
import { determineWinner } from "@/matchmaking/determineWinner";
import { getGameDefinition } from "@/matchmaking/gameDefinition";
import { ensureGamesRegistered } from "@/matchmaking/registerGames";
import { type DefaultEventsMap, Server } from "socket.io";
import { authenticateSocket } from "./auth";
import type { ClientToServerEvents, ServerToClientEvents } from "./events";
import { buildParticipantOutcome, finalizeMatch } from "./matchLifecycle";
import { runMatchmakingTick } from "./queueLoop";
import { MAX_PAYLOAD_LENGTH, parseMatchProgress, parseMatchSubmit, parseQueueJoin } from "./validation";
import {
  abandonmentTimerKey,
  abandonmentTimers,
  activeSockets,
  type AppSocket,
  type SocketData,
} from "./state";

ensureGamesRegistered();

const PORT = Number(process.env.REALTIME_PORT ?? 4000);
const APP_ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const RECONNECT_GRACE_MS = Number(process.env.RECONNECT_GRACE_MS ?? 30_000);
const MATCHMAKING_TICK_MS = 1000;

const rateLimiter = new RateLimiter(REALTIME_RATE_LIMITS);

const httpServer = createServer();
const io = new Server<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, SocketData>(
  httpServer,
  {
    cors: { origin: APP_ORIGIN },
    // Default is 1 MB per message; nothing legitimate here approaches even
    // MAX_PAYLOAD_LENGTH, so reject oversized frames at the transport instead
    // of allocating them. Small headroom for Socket.IO's own framing.
    maxHttpBufferSize: MAX_PAYLOAD_LENGTH * 4,
  },
);

/**
 * Last line of defence: a rejected promise that escapes a handler must not
 * take down the match server for every player in every live match. Handlers
 * are individually wrapped below (see `guard`), so reaching here means a bug
 * — log it loudly, but stay up.
 */
process.on("unhandledRejection", (reason) => {
  console.error("[realtime] unhandled rejection:", reason);
});
process.on("uncaughtException", (error) => {
  console.error("[realtime] uncaught exception:", error);
});

io.use(async (socket, next) => {
  const user = await authenticateSocket(socket);
  if (!user) {
    next(new Error("unauthenticated"));
    return;
  }
  socket.data.user = user;
  next();
});

io.on("connection", (socket) => handleConnection(socket));

/**
 * Wraps an async socket handler so that (a) a throw anywhere inside it —
 * malformed JSON reaching a game's decoder, a Prisma constraint violation,
 * anything — is contained to that one event, and (b) the client gets a plain
 * message instead of a hang. Every `socket.on` below must go through this.
 */
function guard(
  socket: AppSocket,
  event: string,
  handler: (socket: AppSocket, data: unknown) => Promise<void>,
  // Rest params so this fits both the data-carrying events and the
  // no-argument ones (queue:leave, disconnect).
): (...args: unknown[]) => void {
  return (...args: unknown[]) => {
    void handler(socket, args[0]).catch((error) => {
      console.error(`[realtime] ${event} failed for user ${socket.data.user?.id}:`, error);
      socket.emit("error", { message: "Something went wrong handling that action." });
    });
  };
}

/** Consumes a rate-limit token, telling the client when it's been throttled. */
function allow(socket: AppSocket, event: string): boolean {
  const decision = rateLimiter.check(event, socket.data.user.id);
  if (!decision.allowed) {
    socket.emit("error", {
      message: `You're doing that too fast — try again in ${Math.ceil(decision.retryAfterMs / 1000)}s.`,
    });
  }
  return decision.allowed;
}

function handleConnection(socket: AppSocket) {
  const user = socket.data.user;

  const previous = activeSockets.get(user.id);
  if (previous && previous.id !== socket.id) {
    previous.disconnect(true);
  }
  activeSockets.set(user.id, socket);

  // Listeners must be registered synchronously, before any `await` — a
  // client that emits queue:join right after connecting can otherwise race
  // ahead of registration and have the event silently dropped (no listener
  // yet to catch it). recoverActiveMatch does its own DB work afterward.
  socket.on("queue:join", guard(socket, "queue:join", handleQueueJoin));
  socket.on("queue:leave", guard(socket, "queue:leave", handleQueueLeave));
  socket.on("match:progress", guard(socket, "match:progress", handleProgress));
  socket.on("match:submit", guard(socket, "match:submit", handleSubmit));
  socket.on("disconnect", guard(socket, "disconnect", handleDisconnect));

  void recoverActiveMatch(socket).catch((error) => {
    console.error(`[realtime] match recovery failed for user ${user.id}:`, error);
  });
}

/** Reconnect recovery: if this user has an in-progress match, rejoin it and resend its state. */
async function recoverActiveMatch(socket: AppSocket) {
  const user = socket.data.user;
  const participant = await prisma.matchParticipant.findFirst({
    where: { userId: user.id, match: { status: MatchStatus.IN_PROGRESS } },
    include: { match: true },
  });
  if (!participant) return;

  const { match } = participant;
  socket.join(match.id);

  const timerKey = abandonmentTimerKey(match.id, user.id);
  const timer = abandonmentTimers.get(timerKey);
  if (timer) {
    clearTimeout(timer);
    abandonmentTimers.delete(timerKey);
  }

  if (participant.disconnectStatus !== DisconnectStatus.CONNECTED) {
    await prisma.matchParticipant.update({
      where: { id: participant.id },
      data: { disconnectStatus: DisconnectStatus.RECONNECTED },
    });
  }

  const opponent = await prisma.matchParticipant.findFirst({
    where: { matchId: match.id, userId: { not: user.id } },
    include: { user: true },
  });
  if (opponent) {
    activeSockets.get(opponent.userId)?.emit("match:opponentReconnected", { matchId: match.id });
  }

  const clientPayload = await getGameDefinition(match.gameType).getPuzzlePayload(match.puzzleId);
  socket.emit("match:resume", {
    matchId: match.id,
    gameType: match.gameType,
    difficulty: match.difficulty,
    payload: clientPayload,
    opponentUsername: opponent?.user.username ?? "Opponent",
    startsAt: match.startedAt?.getTime() ?? Date.now(),
  });
}

async function handleQueueJoin(socket: AppSocket, data: unknown) {
  const user = socket.data.user;
  if (!allow(socket, "queue:join")) return;

  const input = parseQueueJoin(data);
  if (!input) {
    socket.emit("queue:error", { message: "That game or difficulty isn't valid." });
    return;
  }

  try {
    getGameDefinition(input.gameType);
  } catch {
    socket.emit("queue:error", { message: `${input.gameType} isn't playable yet.` });
    return;
  }

  const alreadyInMatch = await prisma.matchParticipant.findFirst({
    where: { userId: user.id, match: { status: MatchStatus.IN_PROGRESS } },
  });
  if (alreadyInMatch) {
    socket.emit("queue:error", { message: "You're already in an active match." });
    return;
  }

  const rating = await prisma.playerGameRating.findUnique({
    where: { userId_gameType: { userId: user.id, gameType: input.gameType } },
  });
  if (!rating) {
    socket.emit("queue:error", { message: "No rating found for this game." });
    return;
  }

  const queuedAt = new Date();
  await prisma.matchmakingQueueEntry.upsert({
    where: { userId_gameType: { userId: user.id, gameType: input.gameType } },
    update: { difficulty: input.difficulty, rating: rating.rating, queuedAt },
    create: {
      userId: user.id,
      gameType: input.gameType,
      difficulty: input.difficulty,
      rating: rating.rating,
      queuedAt,
    },
  });

  socket.emit("queue:joined", { queuedAt: queuedAt.getTime() });
}

async function handleQueueLeave(socket: AppSocket) {
  const user = socket.data.user;
  if (!allow(socket, "queue:leave")) return;
  await prisma.matchmakingQueueEntry.deleteMany({ where: { userId: user.id } });
  socket.emit("queue:left");
}

async function handleProgress(socket: AppSocket, data: unknown) {
  const user = socket.data.user;
  if (!allow(socket, "match:progress")) return;

  const input = parseMatchProgress(data);
  if (!input) return;

  const participant = await prisma.matchParticipant.findUnique({
    where: { matchId_userId: { matchId: input.matchId, userId: user.id } },
    include: { match: { select: { status: true } } },
  });
  // Membership *and* liveness: without the status check a client could keep
  // broadcasting into a finished match's room indefinitely.
  if (!participant || participant.match.status !== MatchStatus.IN_PROGRESS) return;

  // Trusting the client-reported percent (already clamped to 0-100 by
  // parseMatchProgress): it's cosmetic (opponent-progress display), not a win
  // condition or rating input, so it doesn't warrant the cost/complexity of
  // recomputing it server-side from a full grid on every keystroke — same
  // reasoning as practice mode's durationMs.
  socket
    .to(input.matchId)
    .emit("match:opponentProgress", { matchId: input.matchId, percent: input.percent });
}

async function handleSubmit(socket: AppSocket, data: unknown) {
  const user = socket.data.user;
  if (!allow(socket, "match:submit")) return;

  const input = parseMatchSubmit(data);
  if (!input) {
    socket.emit("error", { message: "That submission was malformed." });
    return;
  }

  const match = await prisma.match.findUnique({ where: { id: input.matchId } });
  if (!match || match.status !== MatchStatus.IN_PROGRESS) return;

  const participant = await prisma.matchParticipant.findUnique({
    where: { matchId_userId: { matchId: match.id, userId: user.id } },
  });
  if (!participant) return;

  // Already recorded a correct solve — re-submitting must not rewrite the
  // completion time that decides the match (and the tie-break against the
  // opponent). Just re-drive resolution in case the first attempt raced.
  if (participant.completionTimeMs !== null) {
    await resolveIfDecided(socket, match.id);
    return;
  }

  const gameDefinition = getGameDefinition(match.gameType);
  const result = await gameDefinition.validateCompletion(match.puzzleId, input.payload);

  if (!result.correct) {
    // Recording mistakes makes determineWinner's mistake tie-break real (it
    // previously compared 0 to 0 forever) and gives anti-cheat foundations
    // (SPEC §11) an actual signal to look at later.
    const updated = await prisma.matchParticipant.update({
      where: { id: participant.id },
      data: { mistakes: { increment: 1 } },
      select: { mistakes: true },
    });
    socket.emit("match:rejected", { matchId: match.id, mistakes: updated.mistakes });
    return;
  }

  // startedAt is the moment the countdown ends and both boards go live (set in
  // queueLoop.ts), so this is the solve time the player actually saw on their
  // timer. Clamped because a submission can technically land during countdown.
  const completionTimeMs = match.startedAt
    ? Math.max(0, Date.now() - match.startedAt.getTime())
    : 0;
  await prisma.matchParticipant.update({
    where: { id: participant.id },
    data: { completionTimeMs },
  });

  await resolveIfDecided(socket, match.id);
}

async function resolveIfDecided(socket: AppSocket, matchId: string) {
  const user = socket.data.user;
  const opponent = await prisma.matchParticipant.findFirst({
    where: { matchId, userId: { not: user.id } },
  });
  if (!opponent) return;

  const [mine, theirs] = await Promise.all([
    buildParticipantOutcome(matchId, user.id),
    buildParticipantOutcome(matchId, opponent.userId),
  ]);

  const outcome = determineWinner([mine, theirs]);
  if (outcome) {
    await finalizeMatch(io, matchId, outcome);
  }
}

async function handleDisconnect(socket: AppSocket) {
  const user = socket.data.user;
  if (activeSockets.get(user.id)?.id !== socket.id) {
    // A newer socket already replaced this one — that connection owns the
    // user's state now, so tearing down their queue entry or starting an
    // abandonment timer here would be wrong.
    return;
  }
  activeSockets.delete(user.id);
  rateLimiter.forget(user.id);

  await prisma.matchmakingQueueEntry.deleteMany({ where: { userId: user.id } });

  const participant = await prisma.matchParticipant.findFirst({
    where: { userId: user.id, match: { status: MatchStatus.IN_PROGRESS } },
  });
  if (!participant) return;

  await prisma.matchParticipant.update({
    where: { id: participant.id },
    data: { disconnectStatus: DisconnectStatus.DISCONNECTED },
  });

  const opponent = await prisma.matchParticipant.findFirst({
    where: { matchId: participant.matchId, userId: { not: user.id } },
  });
  if (opponent) {
    activeSockets.get(opponent.userId)?.emit("match:opponentDisconnected", {
      matchId: participant.matchId,
      graceMs: RECONNECT_GRACE_MS,
    });
  }

  const matchId = participant.matchId;
  const timerKey = abandonmentTimerKey(matchId, user.id);
  const timer = setTimeout(() => {
    void handleAbandonment(matchId, user.id).catch((error) => {
      console.error(`[realtime] abandonment handling failed for match ${matchId}:`, error);
    });
  }, RECONNECT_GRACE_MS);
  abandonmentTimers.set(timerKey, timer);
}

async function handleAbandonment(matchId: string, userId: string) {
  abandonmentTimers.delete(abandonmentTimerKey(matchId, userId));

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match || match.status !== MatchStatus.IN_PROGRESS) return;

  const participant = await prisma.matchParticipant.findUniqueOrThrow({
    where: { matchId_userId: { matchId, userId } },
  });
  if (participant.disconnectStatus !== DisconnectStatus.DISCONNECTED) return; // reconnected in time

  await prisma.matchParticipant.update({
    where: { id: participant.id },
    data: { disconnectStatus: DisconnectStatus.ABANDONED },
  });

  const opponent = await prisma.matchParticipant.findFirst({
    where: { matchId, userId: { not: userId } },
  });
  if (!opponent) return;

  const [mine, theirs] = await Promise.all([
    buildParticipantOutcome(matchId, userId),
    buildParticipantOutcome(matchId, opponent.userId),
  ]);
  const outcome = determineWinner([mine, theirs]);
  if (outcome) {
    await finalizeMatch(io, matchId, outcome);
  }
}

setInterval(() => {
  void runMatchmakingTick(io).catch((error) => {
    console.error("[realtime] matchmaking tick failed:", error);
  });
}, MATCHMAKING_TICK_MS);

httpServer.listen(PORT, () => {
  console.log(`Realtime server listening on :${PORT} (app origin: ${APP_ORIGIN})`);
});
