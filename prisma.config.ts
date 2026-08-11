import { config } from "dotenv";
// Next.js reads .env.local automatically; loading it here too keeps a single
// source of truth for DATABASE_URL instead of duplicating it into a plain .env.
config({ path: ".env.local" });

import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
