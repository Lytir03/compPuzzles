import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";
import { PrismaClient } from "./generated/client/client";

// Next.js loads .env.local automatically, but standalone scripts run via
// `tsx` (seed script, future puzzle-generation workers) don't. dotenv skips
// keys that are already set, so this is a harmless no-op under Next.js.
config({ path: ".env.local" });

// Hot-reload-safe singleton: without this, `next dev`'s module reloading
// would spin up a fresh PrismaClient (and DB connection pool) on every edit.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function poolMaximum(): number {
  const raw = process.env.DATABASE_POOL_MAX ?? "5";
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 20) {
    throw new Error("DATABASE_POOL_MAX must be an integer between 1 and 20");
  }
  return parsed;
}

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) throw new Error("DATABASE_URL is required by the standalone database service");

// Prisma 7's client generator requires an explicit driver adapter — a bare
// connection string on the datasource block is no longer enough at runtime.
const adapter = new PrismaPg({
  connectionString,
  max: poolMaximum(),
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
  allowExitOnIdle: true,
});

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
