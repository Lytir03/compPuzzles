import { prisma } from "@/database/client";
import { CompetitorStatus, type Difficulty, MatchStatus } from "@/database/generated/client/enums";
import { getGameDefinition } from "@/matchmaking/gameDefinition";
import { getRankedMode, type RankedModeId } from "@/games/modes";
import type { Server } from "socket.io";
import { recordFirstCompletion } from "./completion";
import type { ClientToServerEvents, ServerToClientEvents } from "./events";
import { resolveMatchIfDecided } from "./matchLifecycle";
import { reportRealtimeError } from "./observability";
import { withMatchmakingLock } from "./queueLoop";
import { getActiveSocket } from "./state";

type AppServer = Server<ClientToServerEvents, ServerToClientEvents>;

/**
 * Demo-only fallback: if nobody else queues within BOT_FALLBACK_DELAY_MS, the
 * player is matched against a seeded bot account (database/seed.ts) instead.
 * Hard-gated off in production regardless of env misconfiguration, same
 * pattern as TURNSTILE_DEV_BYPASS / AUTH_DEV_ALLOW_IN_MEMORY_RATE_LIMIT.
 */
export function botFallbackEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.MATCHMAKING_BOT_FALLBACK_ENABLED === "true";
}

const BOT_FALLBACK_DELAY_MS = positiveIntegerEnv("MATCHMAKING_BOT_FALLBACK_DELAY_MS", 10_000);
const BOT_USERNAME = process.env.MATCHMAKING_BOT_USERNAME?.trim() || "puzzle_bot";

function positiveIntegerEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

// Difficulty-scaled solve-duration range (ms). Randomized within the range so
// outcomes are mixed rather than the bot always winning or always losing.
const SOLVE_DURATION_MS_BY_DIFFICULTY: Record<Difficulty, readonly [number, number]> = {
  EASY: [25_000, 55_000],
  MEDIUM: [45_000, 90_000],
  HARD: [70_000, 140_000],
};

const PROGRESS_TICK_MIN_MS = 1_500;
const PROGRESS_TICK_MAX_MS = 2_500;

// Mirrors queueLoop.ts's COUNTDOWN_MS so a bot match's board reveal feels
// identical to a real one instead of starting instantly.
const COUNTDOWN_MS = 3_000;

let cachedBotCompetitorId: string | null | undefined;

/** Memoized; resolves once per process, refreshed only on a null result (bot not seeded yet). */
async function resolveBotCompetitorId(): Promise<string | null> {
  if (cachedBotCompetitorId) return cachedBotCompetitorId;
  const profile = await prisma.accountProfile.findUnique({
    where: { usernameCanonical: BOT_USERNAME },
    select: { competitorId: true },
  });
  cachedBotCompetitorId = profile?.competitorId ?? null;
  return cachedBotCompetitorId;
}

const botFallbackTimers = new Map<string, NodeJS.Timeout>();

export function scheduleBotFallback(
  io: AppServer,
  competitorId: string,
  modeId: RankedModeId,
  queueEntryId: string,
): void {
  cancelBotFallback(competitorId);
  const timer = setTimeout(() => {
    botFallbackTimers.delete(competitorId);
    void tryCreateBotMatch(io, modeId, competitorId, queueEntryId).catch((error) => {
      reportRealtimeError("bot_fallback_failed", error);
    });
  }, BOT_FALLBACK_DELAY_MS);
  botFallbackTimers.set(competitorId, timer);
}

export function cancelBotFallback(competitorId: string): void {
  const timer = botFallbackTimers.get(competitorId);
  if (!timer) return;
  clearTimeout(timer);
  botFallbackTimers.delete(competitorId);
}

export function clearAllBotFallbackTimers(): void {
  for (const timer of botFallbackTimers.values()) clearTimeout(timer);
  botFallbackTimers.clear();
}

async function tryCreateBotMatch(
  io: AppServer,
  modeId: RankedModeId,
  competitorId: string,
  queueEntryId: string,
): Promise<void> {
  return withMatchmakingLock(async () => {
    const botCompetitorId = await resolveBotCompetitorId();
    if (!botCompetitorId || botCompetitorId === competitorId || !getActiveSocket(competitorId)) return;

    const mode = getRankedMode(modeId);
    const { gameType, difficulty } = mode;
    const gameDefinition = getGameDefinition(gameType);
    const assignment = await gameDefinition.createMatch(difficulty, [competitorId, botCompetitorId]);
    const startsAt = Date.now() + COUNTDOWN_MS;

    const match = await prisma.$transaction(async (tx) => {
      const entry = await tx.matchmakingQueueEntry.findUnique({ where: { id: queueEntryId } });
      if (!entry || entry.competitorId !== competitorId) return null;

      const activeProfile = await tx.accountProfile.findFirst({
        where: { competitorId, competitor: { status: CompetitorStatus.ACTIVE } },
        select: { competitorId: true },
      });
      if (!activeProfile) return null;

      const [humanRating, botRating] = await Promise.all([
        tx.playerGameRating.findUnique({
          where: { competitorId_gameType: { competitorId, gameType } },
        }),
        tx.playerGameRating.findUnique({
          where: { competitorId_gameType: { competitorId: botCompetitorId, gameType } },
        }),
      ]);
      if (!humanRating || !botRating) return null;

      const alreadyActive = await tx.matchParticipant.findFirst({
        where: { competitorId: { in: [competitorId, botCompetitorId] }, match: { status: MatchStatus.IN_PROGRESS } },
        select: { id: true },
      });
      if (alreadyActive) return null;

      const claimed = await tx.matchmakingQueueEntry.deleteMany({ where: { id: queueEntryId } });
      if (claimed.count !== 1) return null;

      return tx.match.create({
        data: {
          gameType,
          difficulty,
          modeId,
          status: MatchStatus.IN_PROGRESS,
          startedAt: new Date(startsAt),
          puzzleId: assignment.puzzleId,
          participants: {
            create: [
              { competitorId, startingRating: humanRating.rating },
              { competitorId: botCompetitorId, startingRating: botRating.rating },
            ],
          },
        },
      });
    });

    if (!match) return;

    const socket = getActiveSocket(competitorId);
    socket?.join(match.id);
    socket?.emit("match:found", {
      matchId: match.id,
      modeId,
      gameType,
      difficulty,
      payload: assignment.clientPayload,
      opponentUsername: BOT_USERNAME,
      startsAt,
    });

    const botParticipant = await prisma.matchParticipant.findUniqueOrThrow({
      where: { matchId_competitorId: { matchId: match.id, competitorId: botCompetitorId } },
    });
    void runBotGameplay(
      io,
      match.id,
      botParticipant.id,
      botCompetitorId,
      competitorId,
      difficulty,
      match.startedAt,
    ).catch((error) => reportRealtimeError("bot_gameplay_failed", error));
  });
}

async function runBotGameplay(
  io: AppServer,
  matchId: string,
  botParticipantId: string,
  botCompetitorId: string,
  humanCompetitorId: string,
  difficulty: Difficulty,
  startedAt: Date | null,
): Promise<void> {
  const [minMs, maxMs] = SOLVE_DURATION_MS_BY_DIFFICULTY[difficulty];
  const totalDurationMs = minMs + Math.random() * (maxMs - minMs);
  const start = Date.now();

  while (Date.now() - start < totalDurationMs) {
    const waitMs = PROGRESS_TICK_MIN_MS + Math.random() * (PROGRESS_TICK_MAX_MS - PROGRESS_TICK_MIN_MS);
    await sleep(waitMs);

    const match = await prisma.match.findUnique({ where: { id: matchId }, select: { status: true } });
    if (!match || match.status !== MatchStatus.IN_PROGRESS) return;

    // Ease-out curve plus jitter: quick early progress, slower near the end,
    // never robotically linear.
    const elapsedFraction = Math.min(1, (Date.now() - start) / totalDurationMs);
    const eased = 1 - (1 - elapsedFraction) ** 2;
    const percent = Math.max(0, Math.min(99, Math.round(eased * 100 + (Math.random() * 6 - 3))));
    getActiveSocket(humanCompetitorId)?.emit("match:opponentProgress", { matchId, percent });
  }

  const match = await prisma.match.findUnique({ where: { id: matchId }, select: { status: true } });
  if (!match || match.status !== MatchStatus.IN_PROGRESS) return;

  await recordFirstCompletion(botParticipantId, botCompetitorId, startedAt);
  await resolveMatchIfDecided(io, matchId, botCompetitorId);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
