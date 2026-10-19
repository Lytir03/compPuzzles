import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const status = execFileSync("supabase", ["status", "-o", "env"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
});
const local = Object.fromEntries(
  status
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Z0-9_]+)="(.*)"$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2]]),
);

const apiUrl = local.API_URL;
const databaseUrl = local.DB_URL;
const publishableKey = local.PUBLISHABLE_KEY || local.ANON_KEY;
if (!apiUrl || !databaseUrl || !publishableKey) throw new Error("Local Supabase status is incomplete");
for (const [name, value] of [["API_URL", apiUrl], ["DB_URL", databaseUrl]]) {
  const hostname = new URL(value).hostname;
  if (hostname !== "127.0.0.1" && hostname !== "localhost" && hostname !== "[::1]") {
    throw new Error(`${name} is not loopback; refusing to run a destructive local auth test`);
  }
}

const suffix = randomBytes(6).toString("hex");
const email = `auth-policy-${suffix}@example.test`;
const username = `e2e_${suffix}`.slice(0, 20);
const password = `correct-horse-${suffix}`;
const now = new Date().toISOString();
const metadata = {
  username,
  username_canonical: username,
  terms_version: "2026-08-17",
  terms_accepted_at: now,
  age_attested_at: now,
};

const supabase = createClient(apiUrl, publishableKey, {
  auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
});
const database = new pg.Client({ connectionString: databaseUrl });
let authUserId = null;

await database.connect();
try {
  const weak = await supabase.auth.signUp({ email, password: "12345678901", options: { data: metadata } });
  if (!weak.error || weak.data.user || weak.data.session) {
    throw new Error("The public Supabase Auth endpoint accepted a password shorter than 12 characters");
  }

  const signup = await supabase.auth.signUp({ email, password, options: { data: metadata } });
  if (signup.error || !signup.data.user) throw new Error("Direct local signup failed unexpectedly");
  if (signup.data.session) throw new Error("Email confirmation is disabled: signup returned a live session");
  authUserId = signup.data.user.id;
  if (!/^[0-9a-f-]{36}$/i.test(authUserId)) throw new Error("Signup returned an invalid Auth UUID");

  const pending = await database.query(
    `select
       (select count(*)::integer from private."PendingSignup" where "authUserId" = $1) as pending,
       (select count(*)::integer from public."AccountProfile" where "authUserId" = $1) as profile`,
    [authUserId],
  );
  if (pending.rows[0]?.pending !== 1 || pending.rows[0]?.profile !== 0) {
    throw new Error("Unverified signup created the wrong private/profile state");
  }

  const login = await supabase.auth.signInWithPassword({ email, password });
  if (!login.error || login.data.session) {
    throw new Error("An unverified account could sign in");
  }
} finally {
  if (authUserId) {
    await database.query("delete from auth.users where id = $1", [authUserId]);
    const residue = await database.query(
      `select
         (select count(*)::integer from private."PendingSignup" where "authUserId" = $1)
       + (select count(*)::integer from private."UsernameClaim" where "authUserId" = $1) as count`,
      [authUserId],
    );
    if (residue.rows[0]?.count !== 0) throw new Error("Auth test cleanup left private signup data");
  }
  await database.end();
}

console.log("Direct Supabase Auth policy checks passed.");
