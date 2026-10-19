import { prisma } from "@/database/client";
import { CompetitorStatus, MatchStatus } from "@/database/generated/client/enums";
import {
  getRankedMode,
  RANKED_MODE_IDS,
  rankedModeIdFor,
  type RankedModeId,
} from "@/games/modes";
import { getGameDefinition } from "@/matchmaking/gameDefinition";
import { findPairs, type QueueCandidate } from "@/matchmaking/matchmaker";
import type { Server } from "socket.io";
import { cancelBotFallback } from "./bot";
import type { ClientToServerEvents, ServerToClientEvents } from "./events";
import { partitionEligibleQueueEntries } from "./queueEligibility";
import { reportRealtimeError } from "./observability";
import { getActiveSocket } from "./state";

type AppServer = Server<ClientToServerEvents, ServerToClientEvents>;

/** "Match found" → boards go live. Both clients count down to the same server instant. */
const COUNTDOWN_MS = 3000;
const ACTIVE_RETRY_MS = positiveIntegerEnv("MATCHMAKING_ACTIVE_RETRY_MS", 1_000);
const WAITING_RETRY_MS = positiveIntegerEnv("MATCHMAKING_WAITING_RETRY_MS", 15_000);
const ERROR_RETRY_MS = positiveIntegerEnv("MATCHMAKING_ERROR_RETRY_MS", 5_000);

let mutationChain: Promise<void> = Promise.resolve();
let scheduledTimer: NodeJS.Timeout | null = null;
let scheduledAt = 0;
let schedulerStopped = false;

type QueueState = "empty" | "waiting" | "active";

function positiveIntegerEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Serializes queue replacement, leave and pairing in the single Railway
 * replica. The current schema is unique per (user, game), rather than per
 * user globally, so this process lock plus delete-all/create is the strongest
 * global queue invariant, backed by the database's unique competitorId.
 */
export function withMatchmakingLock<T>(work: () => Promise<T>): Promise<T> {
  const result = mutationChain.then(work, work);
  mutationChain = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

/**
 * Event-driven entry point. A new queue mutation pre-empts the slow waiting
 * timer and asks for an immediate pass; while two unmatched candidates remain
 * the scheduler retries quickly so rating windows can widen over time.
 */
export function requestMatchmaking(io: AppServer, delayMs = 0): void {
  if (schedulerStopped) return;
  const target = Date.now() + Math.max(0, delayMs);
  if (scheduledTimer && scheduledAt <= target) return;
  if (scheduledTimer) clearTimeout(scheduledTimer);

  scheduledAt = target;
  scheduledTimer = setTimeout(() => {
    scheduledTimer = null;
    scheduledAt = 0;
    void runMatchmakingTick(io)
      .then((queueState) => {
        if (queueState === "active") requestMatchmaking(io, ACTIVE_RETRY_MS);
        else if (queueState === "waiting") requestMatchmaking(io, WAITING_RETRY_MS);
      })
      .catch((error) => {
        reportRealtimeError("matchmaking_pass_failed", error);
        requestMatchmaking(io, ERROR_RETRY_MS);
      });
  }, Math.max(0, target - Date.now()));
}

export function stopMatchmaking(): void {
  schedulerStopped = true;
  if (scheduledTimer) clearTimeout(scheduledTimer);
  scheduledTimer = null;
  scheduledAt = 0;
}

/** One serialized matchmaking pass, exported for focused integration tests. */
export function runMatchmakingTick(io: AppServer): Promise<QueueState> {
  return withMatchmakingLock(async () => {
    for (const modeId of RANKED_MODE_IDS) {
      await matchQueue(io, modeId);
    }
    return readQueueState();
  });
}

async function matchQueue(io: AppServer, modeId: RankedModeId) {
  const mode = getRankedMode(modeId);
  const entries = await prisma.matchmakingQueueEntry.findMany({
    where: { modeId, gameType: mode.gameType, difficulty: mode.difficulty },
  });
  if (entries.length === 0) return;

  const onlineCompetitorIds = new Set(
    entries
      .filter((entry) => getActiveSocket(entry.competitorId) !== null)
      .map((entry) => entry.competitorId),
  );
  const activeProfiles = onlineCompetitorIds.size === 0
    ? []
    : await prisma.accountProfile.findMany({
        where: {
          competitorId: { in: [...onlineCompetitorIds] },
          competitor: { status: CompetitorStatus.ACTIVE },
        },
        select: { competitorId: true, username: true },
      });
  const { eligible, staleIds, usernames } = partitionEligibleQueueEntries(
    entries,
    onlineCompetitorIds,
    activeProfiles,
  );
  if (staleIds.length > 0) {
    await prisma.matchmakingQueueEntry.deleteMany({ where: { id: { in: staleIds } } });
  }
  if (eligible.length < 2) return;

  const candidates: QueueCandidate[] = eligible.map((entry) => ({
    id: entry.id,
    // QueueCandidate retains its generic historic `userId` name; in ranked
    // persistence this value is always the private competitor UUID.
    userId: entry.competitorId,
    rating: entry.rating,
    queuedAt: entry.queuedAt,
  }));

  for (const pair of findPairs(candidates, new Date())) {
    const usernameA = usernames.get(pair.a.userId);
    const usernameB = usernames.get(pair.b.userId);
    if (!usernameA || !usernameB) continue;
    await createMatchFromPair(io, modeId, pair.a, pair.b, usernameA, usernameB);
  }
}

async function readQueueState(): Promise<QueueState> {
  const entries = await prisma.matchmakingQueueEntry.findMany({
    select: { modeId: true, gameType: true, difficulty: true },
  });
  if (entries.length === 0) return "empty";

  const counts = new Map<RankedModeId, number>();
  for (const entry of entries) {
    const canonicalModeId = rankedModeIdFor(entry.gameType, entry.difficulty);
    if (canonicalModeId && canonicalModeId === entry.modeId) {
      counts.set(canonicalModeId, (counts.get(canonicalModeId) ?? 0) + 1);
    }
  }
  return [...counts.values()].some((count) => count >= 2) ? "active" : "waiting";
}

async function createMatchFromPair(
  io: AppServer,
  modeId: RankedModeId,
  candidateA: QueueCandidate,
  candidateB: QueueCandidate,
  usernameA: string,
  usernameB: string,
) {
  const mode = getRankedMode(modeId);
  const { gameType, difficulty } = mode;
  const competitorIdA = candidateA.userId;
  const competitorIdB = candidateB.userId;

  // Candidate selection and puzzle generation both await. Check current
  // process ownership again before allocating an assignment.
  const offlineEntryIds = [
    getActiveSocket(competitorIdA) ? null : candidateA.id,
    getActiveSocket(competitorIdB) ? null : candidateB.id,
  ].filter((id): id is string => id !== null);
  if (offlineEntryIds.length > 0) {
    await prisma.matchmakingQueueEntry.deleteMany({ where: { id: { in: offlineEntryIds } } });
    return;
  }

  const gameDefinition = getGameDefinition(gameType);
  const assignment = await gameDefinition.createMatch(difficulty, [competitorIdA, competitorIdB]);

  const startsAt = Date.now() + COUNTDOWN_MS;

  const match = await prisma.$transaction(async (tx) => {
    // Repeat account liveness inside the transaction. If deactivation raced
    // selection, consume only that stale row and keep an eligible peer queued.
    const currentProfiles = await tx.accountProfile.findMany({
      where: {
        competitorId: { in: [competitorIdA, competitorIdB] },
        competitor: { status: CompetitorStatus.ACTIVE },
      },
      select: { competitorId: true },
    });
    const activeIds = new Set(currentProfiles.map((profile) => profile.competitorId));
    if (activeIds.size !== 2) {
      const stalePairEntryIds = [
        activeIds.has(competitorIdA) ? null : candidateA.id,
        activeIds.has(competitorIdB) ? null : candidateB.id,
      ].filter((id): id is string => id !== null);
      if (stalePairEntryIds.length > 0) {
        await tx.matchmakingQueueEntry.deleteMany({ where: { id: { in: stalePairEntryIds } } });
      }
      return null;
    }

    const [ratingA, ratingB] = await Promise.all([
      tx.playerGameRating.findUnique({
        where: { competitorId_gameType: { competitorId: competitorIdA, gameType } },
      }),
      tx.playerGameRating.findUnique({
        where: { competitorId_gameType: { competitorId: competitorIdB, gameType } },
      }),
    ]);
    if (!ratingA || !ratingB) {
      await tx.matchmakingQueueEntry.deleteMany({
        where: { id: { in: [candidateA.id, candidateB.id] } },
      });
      return null;
    }

    // Claim the exact rows selected by this pass. Deleting by user/game alone
    // could accidentally consume a fresh replacement queue entry.
    const claimed = await tx.matchmakingQueueEntry.deleteMany({
      where: { id: { in: [candidateA.id, candidateB.id] } },
    });
    if (claimed.count !== 2) return null;

    // Clean legacy duplicates from before queueing became global.
    await tx.matchmakingQueueEntry.deleteMany({
      where: { competitorId: { in: [competitorIdA, competitorIdB] } },
    });

    // A queue row can outlive a process restart. Never create a second live
    // match for either participant when consuming such a stale row.
    const alreadyActive = await tx.matchParticipant.findFirst({
      where: {
        competitorId: { in: [competitorIdA, competitorIdB] },
        match: { status: MatchStatus.IN_PROGRESS },
      },
      select: { id: true },
    });
    if (alreadyActive) return null;

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
            { competitorId: competitorIdA, startingRating: ratingA.rating },
            { competitorId: competitorIdB, startingRating: ratingB.rating },
          ],
        },
      },
    });
  });

  if (!match) return;

  cancelBotFallback(competitorIdA);
  cancelBotFallback(competitorIdB);

  for (const [competitorId, opponentUsername] of [
    [competitorIdA, usernameB],
    [competitorIdB, usernameA],
  ] as const) {
    const socket = getActiveSocket(competitorId);
    socket?.join(match.id);
    socket?.emit("match:found", {
      matchId: match.id,
      modeId,
      gameType,
      difficulty,
      payload: assignment.clientPayload,
      opponentUsername,
      startsAt,
    });
  }
}
