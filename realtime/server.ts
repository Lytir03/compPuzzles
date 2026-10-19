import { createServer } from "node:http";
import { prisma } from "@/database/client";
import { CompetitorStatus, DisconnectStatus, MatchStatus } from "@/database/generated/client/enums";
import { RateLimiter, REALTIME_RATE_LIMITS } from "@/lib/rateLimit";
import { determineWinner } from "@/matchmaking/determineWinner";
import { getRankedMode, isRankedModeId, rankedModeIdFor } from "@/games/modes";
import { getGameDefinition } from "@/matchmaking/gameDefinition";
import { ensureGamesRegistered } from "@/matchmaking/registerGames";
import { type DefaultEventsMap, Server } from "socket.io";
import { authenticateSocket, validateRealtimeAuthConfig } from "./auth";
import { botFallbackEnabled, cancelBotFallback, clearAllBotFallbackTimers, scheduleBotFallback } from "./bot";
import { recordFirstCompletion } from "./completion";
import { withCompetitorConnectionLock } from "./connectionLock";
import {
  realtimeAllowedOrigins,
  realtimeAppOrigin,
  validateRealtimeDeploymentEnv,
} from "./env";
import { handlePracticeHttp } from "./practiceHttp";
import type { ClientToServerEvents, ServerToClientEvents } from "./events";
import { buildParticipantOutcome, finalizeMatch, resolveMatchIfDecided } from "./matchLifecycle";
import {
  flushRealtimeObservability,
  initializeRealtimeObservability,
  logRealtimeEvent,
  reportRealtimeError,
} from "./observability";
import { isAllowedRealtimeOrigin } from "./origin";
import { requestMatchmaking, stopMatchmaking, withMatchmakingLock } from "./queueLoop";
import { claimParticipantReconnect } from "./recovery";
import { getMatchResultForCompetitor } from "./resultSync";
import { realtimeIdentityIsActive } from "./revocation";
import {
  MAX_PAYLOAD_LENGTH,
  parseMatchProgress,
  parseMatchSubmit,
  parseMatchSync,
  parseQueueJoin,
} from "./validation";
import {
  checkDistributedRateLimit,
  getValues,
  realtimeRedisKey,
} from "./upstash";
import {
  abandonmentTimerKey,
  abandonmentTimers,
  activeSockets,
  getActiveSocket,
  ownsActiveSocket,
  type AppSocket,
  type SocketData,
} from "./state";
import { reconcileDecidedMatches } from "./startupReconciliation";
import {
  escalateShutdownExitCode,
  exitCodeForShutdown,
  type ShutdownReason,
} from "./shutdownPolicy";

ensureGamesRegistered();
initializeRealtimeObservability();

const PORT = integerEnv("PORT", integerEnv("REALTIME_PORT", 4_000, 1, 65_535), 1, 65_535);
const APP_ORIGIN = realtimeAppOrigin();
const RECONNECT_GRACE_MS = integerEnv("RECONNECT_GRACE_MS", 30_000, 5_000, 300_000);
const ALLOWED_ORIGINS = realtimeAllowedOrigins(process.env, APP_ORIGIN);

function integerEnv(name: string, fallback: number, minimum: number, maximum: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
  return value;
}

function requiredRealtimeEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required in production`);
  return value;
}

const rateLimiter = new RateLimiter(REALTIME_RATE_LIMITS);

let ready = false;
let shuttingDown = false;
let requestedExitCode: 0 | 1 = 0;
let revocationSweepTimer: NodeJS.Timeout | null = null;

const httpServer = createServer((request, response) => {
  if (request.url === "/health/live") {
    response.writeHead(shuttingDown ? 503 : 200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: shuttingDown ? "stopping" : "ok" }));
    return;
  }
  if (request.url === "/health/ready") {
    response.writeHead(ready && !shuttingDown ? 200 : 503, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: ready && !shuttingDown ? "ready" : "unavailable" }));
    return;
  }
  void handlePracticeHttp(request, response)
    .then((handled) => {
      if (!handled && !response.writableEnded) response.writeHead(404).end();
    })
    .catch((error) => {
      reportRealtimeError("practice_http_handler_failed", error);
      if (!response.headersSent) {
        response.writeHead(500, {
          "cache-control": "private, no-store",
          "content-type": "application/json; charset=utf-8",
        });
      }
      if (!response.writableEnded) response.end(JSON.stringify({ error: "practice_unavailable" }));
    });
});
const io = new Server<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, SocketData>(
  httpServer,
  {
    cors: { origin: ALLOWED_ORIGINS, credentials: false },
    allowRequest: (request, callback) => {
      callback(null, isAllowedRealtimeOrigin(request.headers.origin, ALLOWED_ORIGINS));
    },
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
 * — fail readiness and drain rather than continuing in an unknown state.
 */
process.on("unhandledRejection", (reason) => {
  reportRealtimeError("unhandled_rejection", reason);
  void shutdown("unhandled-rejection", exitCodeForShutdown("unhandled-rejection"));
});
process.on("uncaughtException", (error) => {
  reportRealtimeError("uncaught_exception", error);
  void shutdown("uncaught-exception", exitCodeForShutdown("uncaught-exception"));
});

io.use(async (socket, next) => {
  if (!ready || shuttingDown) {
    next(new Error("temporarily_unavailable"));
    return;
  }
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
      reportRealtimeError("socket_handler_failed", error);
      socket.emit("error", { message: "Something went wrong handling that action." });
    });
  };
}

/** Consumes a rate-limit token, telling the client when it's been throttled. */
async function allow(socket: AppSocket, event: string): Promise<boolean> {
  if (event !== "match:progress" && !(await sessionStillActive(socket))) return false;
  const rule = REALTIME_RATE_LIMITS[event];
  // Progress is cosmetic and can fire on every keystroke; spending one Redis
  // script per edit would exhaust the free Upstash quota without protecting
  // any authoritative state. Keep that generous bucket process-local on the
  // mandated single replica; queue and submit mutations use shared Redis.
  const needsDistributedLimit = process.env.NODE_ENV === "production" && event !== "match:progress";
  const decision = needsDistributedLimit && rule
    ? await checkDistributedRateLimit(
        realtimeRedisKey("rate", `${event}:${socket.data.user.id}`),
        rule.burst,
        Math.ceil((rule.burst / rule.refillPerSecond) * 1_000),
      )
    : rateLimiter.check(event, socket.data.user.id);
  if (!decision.allowed) {
    socket.emit("error", {
      message: `You're doing that too fast — try again in ${Math.ceil(decision.retryAfterMs / 1000)}s.`,
    });
  }
  return decision.allowed;
}

async function sessionStillActive(socket: AppSocket): Promise<boolean> {
  const user = socket.data.user;
  // Competitive mutations must observe logout/reset/delete markers on every
  // event. The periodic sweep remains only a backstop for idle sockets.
  const active = await realtimeIdentityIsActive(user);
  user.revocationCheckedAt = Date.now();
  if (active) return true;

  socket.emit("error", { message: "Your session is no longer active." });
  socket.disconnect(true);
  return false;
}

function handleConnection(socket: AppSocket) {
  const user = socket.data.user;
  const connectedAt = new Date();

  const previous = activeSockets.get(user.id);
  // Publish ownership before disconnecting the old socket. Socket.IO emits
  // its disconnect callback synchronously; reversing these lines lets the
  // old connection delete the queue and start an abandonment timer for the
  // newly connected player.
  activeSockets.set(user.id, socket);
  if (previous && previous.id !== socket.id) {
    previous.disconnect(true);
  }

  // Listeners must be registered synchronously, before any `await` — a
  // client that emits queue:join right after connecting can otherwise race
  // ahead of registration and have the event silently dropped (no listener
  // yet to catch it). recoverActiveMatch does its own DB work afterward.
  socket.on("queue:join", guard(socket, "queue:join", handleQueueJoin));
  socket.on("queue:leave", guard(socket, "queue:leave", handleQueueLeave));
  socket.on("match:sync", guard(socket, "match:sync", handleMatchSync));
  socket.on("match:progress", guard(socket, "match:progress", handleProgress));
  socket.on("match:submit", guard(socket, "match:submit", handleSubmit));
  socket.on("disconnect", guard(socket, "disconnect", handleDisconnect));

  void recoverActiveMatch(socket, connectedAt).catch((error) => {
    reportRealtimeError("match_recovery_failed", error);
  });
}

/** Reconnect recovery: if this user has an in-progress match, rejoin it and resend its state. */
async function recoverActiveMatch(socket: AppSocket, connectedAt: Date) {
  return withCompetitorConnectionLock(
    socket.data.user.id,
    () => recoverActiveMatchLocked(socket, connectedAt),
  );
}

async function recoverActiveMatchLocked(socket: AppSocket, connectedAt: Date) {
  const user = socket.data.user;
  const participant = await prisma.matchParticipant.findFirst({
    where: { competitorId: user.id, match: { status: MatchStatus.IN_PROGRESS } },
    include: { match: true },
  });
  if (!participant || !ownsActiveSocket(socket)) return;

  const { match } = participant;
  const modeId = rankedModeIdFor(match.gameType, match.difficulty);
  if (!modeId || match.modeId !== modeId || !match.puzzleId) {
    await prisma.match.updateMany({
      where: { id: match.id, status: MatchStatus.IN_PROGRESS },
      data: { status: MatchStatus.CANCELLED, completedAt: new Date() },
    });
    socket.emit("error", { message: "That ranked mode is no longer available." });
    return;
  }
  if (participant.disconnectStatus === DisconnectStatus.ABANDONED) return;

  const timerKey = abandonmentTimerKey(match.id, user.id);
  const timerBeforeClaim = abandonmentTimers.get(timerKey);
  const reconnectingFromGrace = participant.disconnectStatus === DisconnectStatus.DISCONNECTED;
  if (reconnectingFromGrace) {
    // Judge timeliness by when the authenticated socket arrived, not by how
    // long DB/puzzle I/O happened to take afterward.
    const claimed = await claimParticipantReconnect(participant.id, connectedAt);
    if (!claimed) {
      // A genuinely late arrival should not suppress a delayed timer merely
      // because it now owns a socket. The abandonment write remains CAS-safe.
      await handleAbandonmentLocked(match.id, user.id, true);
      return;
    }
  } else if (
    participant.disconnectStatus !== DisconnectStatus.CONNECTED
    && participant.disconnectStatus !== DisconnectStatus.RECONNECTED
  ) {
    return;
  }

  // Clear only the timer observed before our CAS. A disconnect that races
  // after the claim may already have installed a new deadline and timer.
  if (timerBeforeClaim && abandonmentTimers.get(timerKey) === timerBeforeClaim) {
    clearTimeout(timerBeforeClaim);
    abandonmentTimers.delete(timerKey);
  }
  if (!ownsActiveSocket(socket)) return;

  const [opponent, clientPayload] = await Promise.all([
    prisma.matchParticipant.findFirst({
      where: { matchId: match.id, competitorId: { not: user.id } },
      include: { competitor: { include: { profile: true } } },
    }),
    getGameDefinition(match.gameType).getPuzzlePayload(match.puzzleId),
  ]);
  if (!ownsActiveSocket(socket)) return;

  await socket.join(match.id);
  if (!ownsActiveSocket(socket)) return;
  if (opponent && reconnectingFromGrace) {
    activeSockets.get(opponent.competitorId)?.emit("match:opponentReconnected", { matchId: match.id });
  }

  socket.emit("match:resume", {
    matchId: match.id,
    modeId,
    gameType: match.gameType,
    difficulty: match.difficulty,
    payload: clientPayload,
    opponentUsername: opponent?.competitor.profile?.username ?? "Deleted player",
    startsAt: match.startedAt?.getTime() ?? Date.now(),
  });
}

async function handleQueueJoin(socket: AppSocket, data: unknown) {
  const user = socket.data.user;
  if (!(await allow(socket, "queue:join"))) return;

  const input = parseQueueJoin(data);
  if (!input) {
    socket.emit("queue:error", { message: "That ranked mode isn't valid." });
    return;
  }

  const mode = getRankedMode(input.modeId);
  const joined = await withMatchmakingLock(async () => {
    // `allow` and parsing both await. A disconnect or replacement during
    // that time must not recreate a durable orphaned queue row.
    if (!ownsActiveSocket(socket)) return null;

    const competitor = await prisma.competitor.findUnique({
      where: { id: user.id },
      select: { status: true },
    });
    if (competitor?.status !== CompetitorStatus.ACTIVE || !ownsActiveSocket(socket)) return null;

    const alreadyInMatch = await prisma.matchParticipant.findFirst({
      where: { competitorId: user.id, match: { status: MatchStatus.IN_PROGRESS } },
    });
    if (alreadyInMatch) return null;

    const rating = await prisma.playerGameRating.findUnique({
      where: { competitorId_gameType: { competitorId: user.id, gameType: mode.gameType } },
    });
    if (!rating) return null;

    return prisma.$transaction(async (tx) => {
      const activeCompetitor = await tx.competitor.findFirst({
        where: { id: user.id, status: CompetitorStatus.ACTIVE },
        select: { id: true },
      });
      if (!activeCompetitor || !ownsActiveSocket(socket)) return null;

      await tx.matchmakingQueueEntry.deleteMany({ where: { competitorId: user.id } });
      const at = new Date();
      const entry = await tx.matchmakingQueueEntry.create({
        data: {
          competitorId: user.id,
          modeId: mode.id,
          gameType: mode.gameType,
          difficulty: mode.difficulty,
          rating: rating.rating,
          queuedAt: at,
        },
      });
      return { at, entryId: entry.id };
    });
  });

  if (!joined) {
    socket.emit("queue:error", { message: "You can't join that queue right now." });
    return;
  }

  socket.emit("queue:joined", { queuedAt: joined.at.getTime() });
  requestMatchmaking(io);
  if (botFallbackEnabled()) {
    scheduleBotFallback(io, user.id, mode.id, joined.entryId);
  }
}

async function handleQueueLeave(socket: AppSocket) {
  const user = socket.data.user;
  if (!(await allow(socket, "queue:leave"))) return;
  const left = await withMatchmakingLock(async () => {
    if (!ownsActiveSocket(socket)) return false;
    await prisma.matchmakingQueueEntry.deleteMany({ where: { competitorId: user.id } });
    return true;
  });
  if (!left) return;
  cancelBotFallback(user.id);
  socket.emit("queue:left");
}

async function handleMatchSync(socket: AppSocket, data: unknown) {
  if (!(await allow(socket, "match:sync"))) return;
  const input = parseMatchSync(data);
  if (!input || !ownsActiveSocket(socket)) return;

  const result = await getMatchResultForCompetitor(input.matchId, socket.data.user.id);
  if (result && ownsActiveSocket(socket)) socket.emit("match:result", result);
}

async function handleProgress(socket: AppSocket, data: unknown) {
  const user = socket.data.user;
  if (!(await allow(socket, "match:progress"))) return;

  const input = parseMatchProgress(data);
  if (!input) return;

  const participant = await prisma.matchParticipant.findUnique({
    where: { matchId_competitorId: { matchId: input.matchId, competitorId: user.id } },
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
  if (!(await allow(socket, "match:submit"))) return;

  const input = parseMatchSubmit(data);
  if (!input) {
    socket.emit("error", { message: "That submission was malformed." });
    return;
  }

  // Authorize membership in the same query that loads match state. Never
  // reveal countdown/mode/liveness details for another player's match.
  const participant = await prisma.matchParticipant.findUnique({
    where: { matchId_competitorId: { matchId: input.matchId, competitorId: user.id } },
    include: { match: true, competitor: { select: { status: true } } },
  });
  if (
    !participant
    || participant.match.status !== MatchStatus.IN_PROGRESS
    || participant.competitor.status !== CompetitorStatus.ACTIVE
  ) return;
  const { match } = participant;
  if (match.modeId !== rankedModeIdFor(match.gameType, match.difficulty) || !match.puzzleId) {
    socket.emit("error", { message: "That ranked mode is no longer available." });
    return;
  }
  if (!match.startedAt || Date.now() < match.startedAt.getTime()) {
    socket.emit("error", { message: "The match countdown hasn't finished yet." });
    return;
  }

  // Already recorded a correct solve — re-submitting must not rewrite the
  // completion time that decides the match (and the tie-break against the
  // opponent). Just re-drive resolution in case the first attempt raced.
  if (participant.completionTimeMs !== null) {
    await resolveMatchIfDecided(io, match.id, user.id);
    return;
  }

  const gameDefinition = getGameDefinition(match.gameType);
  const result = await gameDefinition.validateCompletion(match.puzzleId, input.payload);

  if (!result.correct) {
    // Recording mistakes makes determineWinner's mistake tie-break real (it
    // previously compared 0 to 0 forever) and gives anti-cheat foundations
    // (SPEC §11) an actual signal to look at later.
    const claimed = await prisma.matchParticipant.updateMany({
      where: {
        id: participant.id,
        competitorId: user.id,
        completionTimeMs: null,
        competitor: { status: CompetitorStatus.ACTIVE },
        match: { status: MatchStatus.IN_PROGRESS },
      },
      data: { mistakes: { increment: 1 } },
    });
    if (claimed.count !== 1) return;
    const updated = await prisma.matchParticipant.findUnique({
      where: { id: participant.id },
      select: { mistakes: true },
    });
    socket.emit("match:rejected", { matchId: match.id, mistakes: updated?.mistakes ?? 0 });
    return;
  }

  const completion = await recordFirstCompletion(participant.id, user.id, match.startedAt);
  if (completion === "pre-start") {
    socket.emit("error", { message: "The match countdown hasn't finished yet." });
    return;
  }

  await resolveMatchIfDecided(io, match.id, user.id);
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
  cancelBotFallback(user.id);

  await withMatchmakingLock(() =>
    prisma.matchmakingQueueEntry.deleteMany({ where: { competitorId: user.id } }).then(() => undefined),
  );

  await withCompetitorConnectionLock(user.id, async () => {
    // A replacement may have connected while queue cleanup was awaiting.
    if (getActiveSocket(user.id)) return;

    const participant = await prisma.matchParticipant.findFirst({
      where: { competitorId: user.id, match: { status: MatchStatus.IN_PROGRESS } },
    });
    if (!participant || getActiveSocket(user.id)) return;

    let disconnectDeadlineAt = participant.disconnectDeadlineAt;
    if (
      participant.disconnectStatus === DisconnectStatus.CONNECTED
      || participant.disconnectStatus === DisconnectStatus.RECONNECTED
    ) {
      disconnectDeadlineAt = new Date(Date.now() + RECONNECT_GRACE_MS);
      const marked = await prisma.matchParticipant.updateMany({
        where: {
          id: participant.id,
          disconnectStatus: { in: [DisconnectStatus.CONNECTED, DisconnectStatus.RECONNECTED] },
          match: { status: MatchStatus.IN_PROGRESS },
        },
        data: { disconnectStatus: DisconnectStatus.DISCONNECTED, disconnectDeadlineAt },
      });
      if (marked.count !== 1) return;
    } else if (
      participant.disconnectStatus !== DisconnectStatus.DISCONNECTED
      || !disconnectDeadlineAt
    ) {
      return;
    }

    if (getActiveSocket(user.id)) return;
    scheduleAbandonment(participant.matchId, user.id, disconnectDeadlineAt);

    const opponent = await prisma.matchParticipant.findFirst({
      where: { matchId: participant.matchId, competitorId: { not: user.id } },
    });
    if (opponent && !getActiveSocket(user.id)) {
      activeSockets.get(opponent.competitorId)?.emit("match:opponentDisconnected", {
        matchId: participant.matchId,
        graceMs: Math.max(0, disconnectDeadlineAt.getTime() - Date.now()),
      });
    }
  });
}

function scheduleAbandonment(matchId: string, competitorId: string, deadline: Date) {
  const timerKey = abandonmentTimerKey(matchId, competitorId);
  const existing = abandonmentTimers.get(timerKey);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    void handleAbandonment(matchId, competitorId).catch((error) => {
      reportRealtimeError("abandonment_handling_failed", error);
    });
  }, Math.max(0, deadline.getTime() - Date.now()));
  abandonmentTimers.set(timerKey, timer);
}

async function handleAbandonment(matchId: string, competitorId: string) {
  return withCompetitorConnectionLock(
    competitorId,
    () => handleAbandonmentLocked(matchId, competitorId, false),
  );
}

async function handleAbandonmentLocked(
  matchId: string,
  competitorId: string,
  ignoreActiveSocket: boolean,
) {
  abandonmentTimers.delete(abandonmentTimerKey(matchId, competitorId));
  if (!ignoreActiveSocket && getActiveSocket(competitorId)) return;

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match || match.status !== MatchStatus.IN_PROGRESS) return;

  // Compare-and-set against both state and persisted deadline. A reconnect
  // racing this timer wins safely and cannot be marked abandoned afterward.
  const abandoned = await prisma.matchParticipant.updateMany({
    where: {
      matchId,
      competitorId,
      disconnectStatus: DisconnectStatus.DISCONNECTED,
      disconnectDeadlineAt: { lte: new Date() },
    },
    data: { disconnectStatus: DisconnectStatus.ABANDONED, disconnectDeadlineAt: null },
  });
  if (abandoned.count !== 1) return;

  // If both persisted deadlines elapsed together (for example while this
  // process was restarting), mark both before computing the outcome so a
  // timer ordering accident cannot turn a mutual abandonment into a win.
  await prisma.matchParticipant.updateMany({
    where: {
      matchId,
      competitorId: { not: competitorId },
      disconnectStatus: DisconnectStatus.DISCONNECTED,
      disconnectDeadlineAt: { lte: new Date() },
    },
    data: { disconnectStatus: DisconnectStatus.ABANDONED, disconnectDeadlineAt: null },
  });

  const opponent = await prisma.matchParticipant.findFirst({
    where: { matchId, competitorId: { not: competitorId } },
  });
  if (!opponent) return;

  const [mine, theirs] = await Promise.all([
    buildParticipantOutcome(matchId, competitorId),
    buildParticipantOutcome(matchId, opponent.competitorId),
  ]);
  const outcome = determineWinner([mine, theirs]);
  if (outcome) {
    await finalizeMatch(io, matchId, outcome);
  }
}

httpServer.listen(PORT, () => {
  logRealtimeEvent("listening", { port: PORT, allowedOrigins: ALLOWED_ORIGINS.length });
  void prepareRuntime().catch((error) => {
    reportRealtimeError("startup_reconciliation_failed", error);
    void shutdown("startup-failure", exitCodeForShutdown("startup-failure"));
  });
});

async function prepareRuntime() {
  await validateRuntimeSecurityConfig();
  // Queue ownership is process-local. After a restart no persisted row has a
  // live owning socket, so clear all of them before readiness is published.
  await prisma.matchmakingQueueEntry.deleteMany({});

  const liveMatches = await prisma.match.findMany({
    where: { status: MatchStatus.IN_PROGRESS },
    select: { id: true, modeId: true, gameType: true, difficulty: true },
  });
  const invalidMatchIds = liveMatches
    .filter((match) => {
      if (!isRankedModeId(match.modeId)) return true;
      const mode = getRankedMode(match.modeId);
      return mode.gameType !== match.gameType || mode.difficulty !== match.difficulty;
    })
    .map((match) => match.id);
  if (invalidMatchIds.length > 0) {
    await prisma.match.updateMany({
      where: { id: { in: invalidMatchIds }, status: MatchStatus.IN_PROGRESS },
      data: { status: MatchStatus.CANCELLED, completedAt: new Date() },
    });
  }

  // A process restart invalidates every old in-memory socket. Persist that
  // fact before accepting new connections so players get the normal grace
  // window instead of leaving immortal IN_PROGRESS matches behind.
  const restartDeadline = new Date(Date.now() + RECONNECT_GRACE_MS);
  await prisma.matchParticipant.updateMany({
    where: {
      disconnectStatus: { in: [DisconnectStatus.CONNECTED, DisconnectStatus.RECONNECTED] },
      match: { status: MatchStatus.IN_PROGRESS },
    },
    data: {
      disconnectStatus: DisconnectStatus.DISCONNECTED,
      disconnectDeadlineAt: restartDeadline,
    },
  });

  // Resolve every completion/abandonment persisted before a crash *before*
  // arming any timeout. finalizeMatch's status CAS makes this idempotent.
  await reconcileDecidedMatches(io);

  const disconnected = await prisma.matchParticipant.findMany({
    where: {
      disconnectStatus: DisconnectStatus.DISCONNECTED,
      match: { status: MatchStatus.IN_PROGRESS },
    },
    select: { id: true, matchId: true, competitorId: true, disconnectDeadlineAt: true },
  });
  for (const participant of disconnected) {
    let deadline = participant.disconnectDeadlineAt;
    if (!deadline) {
      deadline = new Date(Date.now() + RECONNECT_GRACE_MS);
      await prisma.matchParticipant.update({
        where: { id: participant.id },
        data: { disconnectDeadlineAt: deadline },
      });
    }
    scheduleAbandonment(participant.matchId, participant.competitorId, deadline);
  }

  ready = true;
  revocationSweepTimer = setInterval(() => {
    void sweepRevokedSockets().catch((error) => {
      reportRealtimeError("revocation_sweep_failed", error);
    });
  }, 10_000);
  revocationSweepTimer.unref();
  requestMatchmaking(io);
}

async function validateRuntimeSecurityConfig() {
  await validateRealtimeAuthConfig();
  if (process.env.NODE_ENV !== "production") return;
  requiredRealtimeEnv("UPSTASH_REDIS_REST_TOKEN");
  validateRealtimeDeploymentEnv();
  // Also validates construction of the shared HMAC key namespace.
  realtimeRedisKey("jti", "startup-check");
}

async function sweepRevokedSockets() {
  const sockets = [...activeSockets.values()];
  if (sockets.length === 0) return;

  // One MGET keeps the ten-second sweep affordable on Upstash Free. If Redis
  // is unavailable, leave existing sockets alone; new admissions and their
  // next sensitive mutation still fail closed independently.
  const keys = sockets.flatMap((socket) => [
    realtimeRedisKey("sid", socket.data.user.sessionId),
    realtimeRedisKey("sub", socket.data.user.authUserId),
  ]);
  const result = await getValues(keys);
  if (!result.available) return;

  const now = Date.now();
  for (let index = 0; index < sockets.length; index++) {
    const socket = sockets[index];
    const sessionMarker = result.values[index * 2];
    const subjectMarker = result.values[index * 2 + 1];
    const cutoff = subjectMarker === null ? null : Number(subjectMarker);
    const invalidCutoff = cutoff !== null && (!Number.isSafeInteger(cutoff) || cutoff < 0);
    socket.data.user.revocationCheckedAt = now;
    if (
      sessionMarker !== null ||
      invalidCutoff ||
      (cutoff !== null && socket.data.user.ticketIssuedAt <= cutoff)
    ) {
      socket.emit("error", { message: "Your session is no longer active." });
      socket.disconnect(true);
    }
  }
}

async function shutdown(signal: ShutdownReason, exitCode: 0 | 1) {
  requestedExitCode = escalateShutdownExitCode(requestedExitCode, exitCode);
  if (shuttingDown) return;
  shuttingDown = true;
  ready = false;
  stopMatchmaking();
  if (revocationSweepTimer) clearInterval(revocationSweepTimer);
  revocationSweepTimer = null;
  for (const timer of abandonmentTimers.values()) clearTimeout(timer);
  abandonmentTimers.clear();
  clearAllBotFallbackTimers();
  logRealtimeEvent("shutdown_started", { reason: signal, exitCode: requestedExitCode });

  const forceExit = setTimeout(() => process.exit(1), 10_000);
  forceExit.unref();

  const connectedCompetitors = [...activeSockets.keys()];
  if (connectedCompetitors.length > 0) {
    const disconnectDeadlineAt = new Date(Date.now() + RECONNECT_GRACE_MS);
    await Promise.all([
      prisma.matchmakingQueueEntry.deleteMany({
        where: { competitorId: { in: connectedCompetitors } },
      }),
      prisma.matchParticipant.updateMany({
        where: {
          competitorId: { in: connectedCompetitors },
          match: { status: MatchStatus.IN_PROGRESS },
        },
        data: { disconnectStatus: DisconnectStatus.DISCONNECTED, disconnectDeadlineAt },
      }),
    ]).catch(() => undefined);
  }

  io.close(async () => {
    await prisma.$disconnect().catch(() => undefined);
    await flushRealtimeObservability();
    clearTimeout(forceExit);
    process.exit(requestedExitCode);
  });
}

process.on("SIGTERM", () => void shutdown("SIGTERM", exitCodeForShutdown("SIGTERM")));
process.on("SIGINT", () => void shutdown("SIGINT", exitCodeForShutdown("SIGINT")));
