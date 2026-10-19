import { randomUUID, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { prisma } from "@/database/client";
import { CompetitorStatus } from "@/database/generated/client/enums";
import { getRankedMode, isRankedModeId } from "@/games/modes";
import { getGameDefinition } from "@/matchmaking/gameDefinition";
import {
  getAndDeleteValue,
  realtimeRedisKey,
  setExpiringValue,
} from "./upstash";
import { checkPracticeRateLimit, type PracticeRateOperation } from "./practiceRate";
import { claimActivePracticeAttempt } from "./practiceAttempt";
import { practiceSessionIsActive } from "./practiceSession";

const BODY_LIMIT = 20_000;
const ASSIGNMENT_TTL_MS = 30 * 60 * 1_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLIENT_KEY_PATTERN = /^[0-9a-f]{64}$/;

interface GuestAssignment {
  puzzleId: string;
  modeId: string;
  createdAt: number;
}

function practiceSecret(): string {
  const configured = process.env.PRACTICE_API_SECRET?.trim();
  if (configured && configured.length >= 32) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("PRACTICE_API_SECRET (at least 32 characters) is required in production");
  }
  return "comppuzzles-local-practice-secret-only";
}

function secretMatches(request: IncomingMessage): boolean {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(header.slice(7));
  const expected = Buffer.from(practiceSecret());
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function json(response: ServerResponse, status: number, body: Record<string, unknown>) {
  response.writeHead(status, {
    "cache-control": "private, no-store",
    "content-type": "application/json; charset=utf-8",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const declared = Number(request.headers["content-length"] ?? "0");
  if (Number.isFinite(declared) && declared > BODY_LIMIT) throw new Error("body_too_large");
  let raw = "";
  for await (const chunk of request) {
    raw += String(chunk);
    if (Buffer.byteLength(raw) > BODY_LIMIT) throw new Error("body_too_large");
  }
  return JSON.parse(raw || "{}");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]) {
  return Object.keys(value).every((key) => allowed.includes(key))
    && allowed.every((key) => key in value);
}

async function rateAllowed(request: IncomingMessage, operation: PracticeRateOperation) {
  if (process.env.NODE_ENV !== "production") return true;
  const clientKey = request.headers["x-practice-client"];
  if (typeof clientKey !== "string" || !CLIENT_KEY_PATTERN.test(clientKey)) return false;
  return checkPracticeRateLimit(operation, clientKey, authUserId(request));
}

function authUserId(request: IncomingMessage): string | null {
  const value = request.headers["x-auth-user-id"];
  return typeof value === "string" && UUID_PATTERN.test(value) ? value : null;
}

function authSessionId(request: IncomingMessage): string | null {
  const value = request.headers["x-auth-session-id"];
  return typeof value === "string" ? value : null;
}

/** Handles the BFF-only practice API. Returns false for unrelated paths. */
export async function handlePracticeHttp(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<boolean> {
  const pathname = new URL(request.url ?? "/", "http://realtime.internal").pathname;
  if (pathname !== "/api/practice/start" && pathname !== "/api/practice/submit") return false;

  if (request.method !== "POST" || !secretMatches(request)) {
    json(response, request.method === "POST" ? 401 : 405, { error: "request_denied" });
    return true;
  }

  const operation = pathname.endsWith("/start") ? "start" : "submit";
  if (!(await rateAllowed(request, operation))) {
    json(response, 429, { error: "rate_limited" });
    return true;
  }
  if (!(await practiceSessionIsActive(authUserId(request), authSessionId(request)))) {
    json(response, 401, { error: "request_denied" });
    return true;
  }

  let body: unknown;
  try {
    body = await readJson(request);
  } catch {
    json(response, 400, { error: "invalid_body" });
    return true;
  }

  if (operation === "start") await startPractice(request, response, body);
  else await submitPractice(request, response, body);
  return true;
}

async function startPractice(request: IncomingMessage, response: ServerResponse, body: unknown) {
  if (!isRecord(body) || !hasOnlyKeys(body, ["modeId"]) || !isRankedModeId(body.modeId)) {
    json(response, 400, { error: "invalid_mode" });
    return;
  }
  const mode = getRankedMode(body.modeId);
  const assignment = await getGameDefinition(mode.gameType).createMatch(mode.difficulty, []);
  const userId = authUserId(request);
  const expiresAt = new Date(Date.now() + ASSIGNMENT_TTL_MS);

  if (userId) {
    const account = await prisma.accountProfile.findUnique({
      where: { authUserId: userId },
      select: { competitor: { select: { status: true } } },
    });
    if (!account || account.competitor.status !== CompetitorStatus.ACTIVE) {
      json(response, 403, { error: "account_unavailable" });
      return;
    }
    const attempt = await prisma.puzzleAttempt.create({
      data: {
        assignmentId: randomUUID(),
        authUserId: userId,
        puzzleId: assignment.puzzleId,
        expiresAt,
      },
      select: { assignmentId: true },
    });
    json(response, 200, {
      assignmentId: attempt.assignmentId,
      payload: assignment.clientPayload,
      expiresAt: expiresAt.toISOString(),
    });
    return;
  }

  const assignmentId = randomUUID();
  const stored = await setExpiringValue(
    realtimeRedisKey("practice", assignmentId),
    JSON.stringify({ puzzleId: assignment.puzzleId, modeId: body.modeId, createdAt: Date.now() }),
    ASSIGNMENT_TTL_MS,
  );
  if (!stored) {
    json(response, 503, { error: "practice_unavailable" });
    return;
  }
  json(response, 200, {
    assignmentId,
    payload: assignment.clientPayload,
    expiresAt: expiresAt.toISOString(),
  });
}

async function submitPractice(request: IncomingMessage, response: ServerResponse, body: unknown) {
  if (
    !isRecord(body)
    || !hasOnlyKeys(body, ["assignmentId", "payload"])
    || typeof body.assignmentId !== "string"
    || !UUID_PATTERN.test(body.assignmentId)
    || typeof body.payload !== "string"
    || body.payload.length === 0
    || body.payload.length > 16_384
  ) {
    json(response, 400, { error: "invalid_submission" });
    return;
  }

  const userId = authUserId(request);
  let assignment: GuestAssignment | null = null;
  let persistedAttemptId: string | null = null;

  if (userId) {
    const attempt = await prisma.puzzleAttempt.findFirst({
      where: {
        assignmentId: body.assignmentId,
        authUserId: userId,
        submittedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        puzzle: { select: { gameType: true, difficulty: true } },
        account: { select: { competitor: { select: { status: true } } } },
      },
    });
    if (attempt?.account.competitor.status === CompetitorStatus.ACTIVE) {
      persistedAttemptId = attempt.id;
      assignment = {
        puzzleId: attempt.puzzleId,
        modeId: `${attempt.puzzle.gameType}:${attempt.puzzle.difficulty}`,
        createdAt: attempt.createdAt.getTime(),
      };
    }
  } else {
    const consumed = await getAndDeleteValue(realtimeRedisKey("practice", body.assignmentId));
    if (!consumed.available) {
      json(response, 503, { error: "practice_unavailable" });
      return;
    }
    try {
      const parsed = consumed.value ? JSON.parse(consumed.value) as unknown : null;
      if (
        isRecord(parsed)
        && typeof parsed.puzzleId === "string"
        && typeof parsed.modeId === "string"
        && typeof parsed.createdAt === "number"
      ) assignment = parsed as unknown as GuestAssignment;
    } catch {
      assignment = null;
    }
  }

  if (!assignment) {
    json(response, 404, { error: "assignment_expired" });
    return;
  }

  const puzzle = await prisma.puzzle.findUnique({
    where: { id: assignment.puzzleId },
    select: { gameType: true },
  });
  if (!puzzle || puzzle.gameType === "CROSSWORD") {
    json(response, 400, { error: "invalid_assignment" });
    return;
  }

  const result = await getGameDefinition(puzzle.gameType).validateCompletion(
    assignment.puzzleId,
    body.payload,
  );
  const durationMs = Math.max(0, Math.min(86_400_000, Date.now() - assignment.createdAt));

  if (persistedAttemptId && userId) {
    const claimed = await claimActivePracticeAttempt(persistedAttemptId, userId, {
      submittedAt: new Date(),
      durationMs,
      completed: result.correct,
      mistakes: result.correct ? 0 : 1,
    });
    if (!claimed) {
      json(response, 409, { error: "assignment_consumed" });
      return;
    }
  }

  json(response, 200, { complete: result.complete, correct: result.correct });
}
