/** Disposable local integration test. Never accepts a hosted database or API. */
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";
import { exportSPKI, generateKeyPair, SignJWT } from "jose";
import { io, type Socket } from "socket.io-client";
import { generatePuzzle, SUDOKU_VARIANTS } from "../games/sudoku/generator";
import { gridToString } from "../games/sudoku/engine";
import { generatePuzzle as generateNonogram } from "../games/nonogram/generator";
import { encodeGrid } from "../games/nonogram/engine";

async function main() {
  const workdir = process.env.SUPABASE_TEST_WORKDIR;
  const status = JSON.parse(execFileSync("supabase", ["status", "-o", "json", ...(workdir ? ["--workdir", workdir] : [])], {
    encoding: "utf8", stdio: ["ignore", "pipe", "inherit"],
  })) as Record<string, string>;
  for (const name of ["API_URL", "DB_URL"]) {
    assert(["127.0.0.1", "localhost", "[::1]"].includes(new URL(status[name]).hostname), "Integration tests require loopback services");
  }
  process.env.DATABASE_URL = status.DB_URL;
  const { prisma } = await import("../database/client");
  const admin = createClient(status.API_URL, status.SECRET_KEY || status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const key = await generateKeyPair("EdDSA", { extractable: true });
  const port = 4_100;
  const origin = "http://localhost:3000";
  const service = `http://127.0.0.1:${port}`;
  const suffix = randomUUID().slice(0, 8);
  const authIds: string[] = [];
  const competitorIds: string[] = [];
  const puzzleIds: string[] = [];
  const sockets: Socket[] = [];
  let server: ReturnType<typeof spawn> | undefined;

  function event<T = unknown>(socket: Socket, name: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const listener = (value: T) => { clearTimeout(timer); resolve(value); };
      const timer = setTimeout(() => { socket.off(name, listener); reject(new Error(`Timed out waiting for ${name}`)); }, 15_000);
      socket.once(name, listener);
    });
  }

  async function connect(userId: string, beforeConnect?: (socket: Socket) => void) {
    const now = Math.floor(Date.now() / 1_000);
    const ticket = await new SignJWT({ sid: randomUUID(), v: 1 })
      .setProtectedHeader({ alg: "EdDSA", typ: "rt+jwt", kid: "integration" })
      .setIssuer(origin).setAudience("comppuzzles-realtime").setSubject(userId)
      .setJti(randomUUID()).setIssuedAt(now).setNotBefore(now - 1).setExpirationTime(now + 90).sign(key.privateKey);
    const socket = io(service, { auth: { ticket }, extraHeaders: { Origin: origin }, autoConnect: false, reconnection: false });
    sockets.push(socket);
    const connected = event(socket, "connect");
    beforeConnect?.(socket);
    socket.connect();
    await connected;
    return socket;
  }

  type Found = { matchId: string; gameType: string; payload: string; startsAt: number };
  type Result = { matchId: string; outcome: string; ratingBefore: number; ratingAfter: number };

  try {
    assert(!(await fetch(`${service}/health/live`).catch(() => null)), "Port 4100 is already occupied; refusing to use another server");
    const existingRows = await Promise.all([prisma.competitor.count(), prisma.puzzle.count(), prisma.match.count()]);
    assert(existingRows.every((count) => count === 0), "Run against a fresh isolated stack; refusing to touch existing development data");
    for (let index = 0; index < 2; index++) {
      const now = new Date().toISOString();
      const username = `loop_${suffix}_${index}`;
      const created = await admin.auth.admin.createUser({
        email: `${username}@example.test`, password: randomUUID(), email_confirm: true,
        user_metadata: { username, terms_version: "2026-08-17", terms_accepted_at: now, age_attested_at: now },
      });
      assert.ifError(created.error);
      authIds.push(created.data.user!.id);
      const profile = await prisma.accountProfile.findUniqueOrThrow({ where: { authUserId: authIds[index] } });
      competitorIds.push(profile.competitorId);
    }

    server = spawn(process.execPath, ["--import", "tsx", "realtime/server.ts"], {
      cwd: process.cwd(), stdio: ["ignore", "ignore", "inherit"], env: {
        ...process.env, NODE_ENV: "test", PORT: String(port), DATABASE_URL: status.DB_URL,
        NEXT_PUBLIC_APP_URL: origin, REALTIME_ALLOWED_ORIGINS: origin,
        REALTIME_JWS_ISSUER: origin, REALTIME_JWS_AUDIENCE: "comppuzzles-realtime",
        REALTIME_JWS_KEY_ID: "integration", REALTIME_JWS_PUBLIC_KEY: await exportSPKI(key.publicKey),
        REALTIME_JWS_PUBLIC_KEYS: "", UPSTASH_REDIS_REST_URL: "", UPSTASH_REDIS_REST_TOKEN: "",
        MATCHMAKING_BOT_FALLBACK_ENABLED: "false",
      },
    });
    let ready = false;
    for (let attempt = 0; attempt < 75; attempt++) {
      if ((await fetch(`${service}/health/ready`).catch(() => null))?.ok) { ready = true; break; }
      if (server.exitCode !== null) break;
      await delay(200);
    }
    assert(ready, "Realtime server did not become ready");

    for (const gameType of ["SUDOKU", "NONOGRAM"] as const) {
      const sudoku = generatePuzzle("EASY");
      const nonogram = generateNonogram("EASY");
      const solution = gameType === "SUDOKU" ? gridToString(sudoku.solution) : encodeGrid(nonogram.solution);
      const puzzle = await prisma.puzzle.create({ data: {
        gameType, difficulty: "EASY", status: "PUBLISHED",
        metadata: gameType === "SUDOKU" ? { variant: SUDOKU_VARIANTS.EASY } : {},
        ...(gameType === "SUDOKU" ? { sudoku: { create: {
          grid: gridToString(sudoku.grid), secret: { create: { solution } },
        } } } : { nonogram: { create: {
          width: nonogram.dims.width, height: nonogram.dims.height,
          rowClues: nonogram.rowClues, colClues: nonogram.colClues,
          secret: { create: { solutionGrid: nonogram.solution } },
        } } }),
      } });
      puzzleIds.push(puzzle.id);
      // A clean test stack guarantees the assigned puzzle is this fixture.
      const modeCount = await prisma.puzzle.count({ where: { gameType, difficulty: "EASY", status: "PUBLISHED" } });
      assert.equal(modeCount, 1, "Run against a fresh isolated stack; existing puzzles would make this test nondeterministic");

      let a = await connect(authIds[0]);
      const b = await connect(authIds[1]);
      const foundA = event<Found>(a, "match:found"), foundB = event<Found>(b, "match:found");
      const modeId = gameType === "SUDOKU" ? "SUDOKU_6X6_CHALLENGE" : "NONOGRAM_5X5";
      a.emit("queue:join", { modeId }); b.emit("queue:join", { modeId });
      const [matchA, matchB] = await Promise.all([foundA, foundB]);
      assert.equal(matchA.matchId, matchB.matchId);
      assert.equal(matchA.payload, matchB.payload);
      assert.notEqual(matchA.payload, solution, "A solution leaked in the match assignment");

      const premature = event<{ message: string }>(a, "error");
      a.emit("match:submit", { matchId: matchA.matchId, payload: solution });
      assert.match((await premature).message, /countdown/);
      await delay(Math.max(0, matchA.startsAt - Date.now()) + 50);
      const rejected = event(a, "match:rejected");
      a.emit("match:submit", { matchId: matchA.matchId, payload: gameType === "SUDOKU" ? "0".repeat(36) : encodeGrid(new Array(25).fill(0)) });
      await rejected;

      a.disconnect();
      await delay(100);
      // Register the recovery listener before the connection can replay state.
      let resumed!: Promise<Found>;
      const recovered = await connect(authIds[0], (socket) => { resumed = event<Found>(socket, "match:resume"); });
      a = recovered;
      assert.equal((await resumed).matchId, matchA.matchId);
      const resultA = event<Result>(a, "match:result"), resultB = event<Result>(b, "match:result");
      a.emit("match:submit", { matchId: matchA.matchId, payload: solution });
      a.emit("match:submit", { matchId: matchA.matchId, payload: solution });
      const [winner, loser] = await Promise.all([resultA, resultB]);
      assert.equal(winner.outcome, "WIN"); assert.equal(loser.outcome, "LOSS");
      assert(winner.ratingAfter > winner.ratingBefore); assert(loser.ratingAfter < loser.ratingBefore);
      await delay(150);
      assert.equal(await prisma.ratingChange.count({ where: { matchId: matchA.matchId } }), 2);
      assert.equal((await prisma.match.findUniqueOrThrow({ where: { id: matchA.matchId } })).status, "COMPLETED");
      const replayed = event<Result>(a, "match:result");
      a.emit("match:sync", { matchId: matchA.matchId });
      assert.equal((await replayed).outcome, "WIN");
      a.disconnect(); b.disconnect();
      console.log(`${gameType}: queue, countdown, invalid grid, reconnect, completion, duplicate rating protection and result replay passed.`);
    }
  } finally {
    for (const socket of sockets) socket.disconnect();
    if (server && server.exitCode === null) { const exited = once(server, "exit"); server.kill("SIGTERM"); await exited; }
    await prisma.match.deleteMany({ where: { participants: { some: { competitorId: { in: competitorIds } } } } });
    for (const id of authIds) {
      const removed = await admin.auth.admin.deleteUser(id);
      assert.ifError(removed.error);
    }
    await prisma.matchmakingQueueEntry.deleteMany({ where: { competitorId: { in: competitorIds } } });
    await prisma.playerGameRating.deleteMany({ where: { competitorId: { in: competitorIds } } });
    await prisma.competitor.deleteMany({ where: { id: { in: competitorIds } } });
    await prisma.puzzle.deleteMany({ where: { id: { in: puzzleIds } } });
    await prisma.$disconnect();
  }

}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
