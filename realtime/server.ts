import { createServer } from "node:http";
import { prisma } from "@/database/client";
import { Difficulty, DisconnectStatus, GameType, MatchStatus } from "@/database/generated/client/enums";
import { determineWinner } from "@/matchmaking/determineWinner";
import { getGameDefinition } from "@/matchmaking/gameDefinition";
import { ensureGamesRegistered } from "@/matchmaking/registerGames";
import { type DefaultEventsMap, Server } from "socket.io";
import { authenticateSocket } from "./auth";
import type { ClientToServerEvents, ServerToClientEvents } from "./events";
import { buildParticipantOutcome, finalizeMatch } from "./matchLifecycle";
import { runMatchmakingTick } from "./queueLoop";
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

const httpServer = createServer();
const io = new Server<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, SocketData>(
  httpServer,
  { cors: { origin: APP_ORIGIN } },
);

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
  socket.on("queue:join", (data) => handleQueueJoin(socket, data));
  socket.on("queue:leave", () => handleQueueLeave(socket));
  socket.on("match:progress", (data) => handleProgress(socket, data));
  socket.on("match:submit", (data) => handleSubmit(socket, data));
  socket.on("disconnect", () => handleDisconnect(socket));

  void recoverActiveMatch(socket);
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

async function handleQueueJoin(
  socket: AppSocket,
  data: { gameType: GameType; difficulty: Difficulty },
) {
  const user = socket.data.user;

  try {
    getGameDefinition(data.gameType);
  } catch {
    socket.emit("queue:error", { message: `${data.gameType} isn't playable yet.` });
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
    where: { userId_gameType: { userId: user.id, gameType: data.gameType } },
  });
  if (!rating) {
    socket.emit("queue:error", { message: "No rating found for this game." });
    return;
  }

  const queuedAt = new Date();
  await prisma.matchmakingQueueEntry.upsert({
    where: { userId_gameType: { userId: user.id, gameType: data.gameType } },
    update: { difficulty: data.difficulty, rating: rating.rating, queuedAt },
    create: {
      userId: user.id,
      gameType: data.gameType,
      difficulty: data.difficulty,
      rating: rating.rating,
      queuedAt,
    },
  });

  socket.emit("queue:joined", { queuedAt: queuedAt.getTime() });
}

async function handleQueueLeave(socket: AppSocket) {
  const user = socket.data.user;
  await prisma.matchmakingQueueEntry.deleteMany({ where: { userId: user.id } });
  socket.emit("queue:left");
}

async function handleProgress(socket: AppSocket, data: { matchId: string; percent: number }) {
  const user = socket.data.user;
  const participant = await prisma.matchParticipant.findUnique({
    where: { matchId_userId: { matchId: data.matchId, userId: user.id } },
  });
  if (!participant) return;

  // Trusting the client-reported percent: it's cosmetic (opponent-progress
  // display), not a win condition or rating input, so it doesn't warrant
  // the cost/complexity of recomputing it server-side from a full grid on
  // every keystroke — same reasoning as practice mode's durationMs.
  const percent = Math.max(0, Math.min(100, Math.round(data.percent)));
  socket.to(data.matchId).emit("match:opponentProgress", { matchId: data.matchId, percent });
}

async function handleSubmit(socket: AppSocket, data: { matchId: string; payload: string }) {
  const user = socket.data.user;
  const match = await prisma.match.findUnique({ where: { id: data.matchId } });
  if (!match || match.status !== MatchStatus.IN_PROGRESS) return;

  const participant = await prisma.matchParticipant.findUnique({
    where: { matchId_userId: { matchId: match.id, userId: user.id } },
  });
  if (!participant) return;

  const gameDefinition = getGameDefinition(match.gameType);
  const clientPayload = await gameDefinition.getPuzzlePayload(match.puzzleId);
  const result = gameDefinition.validateCompletion(clientPayload, data.payload);

  if (!result.correct) {
    socket.emit("error", { message: "Not quite — keep going." });
    return;
  }

  const completionTimeMs = match.startedAt ? Date.now() - match.startedAt.getTime() : 0;
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
  if (activeSockets.get(user.id)?.id === socket.id) {
    activeSockets.delete(user.id);
  }

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
    });
  }

  const matchId = participant.matchId;
  const timerKey = abandonmentTimerKey(matchId, user.id);
  const timer = setTimeout(() => void handleAbandonment(matchId, user.id), RECONNECT_GRACE_MS);
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

setInterval(() => void runMatchmakingTick(io), MATCHMAKING_TICK_MS);

httpServer.listen(PORT, () => {
  console.log(`Realtime server listening on :${PORT} (app origin: ${APP_ORIGIN})`);
});
