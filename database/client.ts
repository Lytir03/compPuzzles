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

// Prisma 7's client generator requires an explicit driver adapter — a bare
// connection string on the datasource block is no longer enough at runtime.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
