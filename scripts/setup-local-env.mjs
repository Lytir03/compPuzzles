import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { generateKeyPairSync, randomBytes } from "node:crypto";

const target = new URL("../.env.local", import.meta.url);
const template = new URL("../.env.example", import.meta.url);

if (existsSync(target)) {
  console.error(".env.local already exists; refusing to overwrite it. Move it aside explicitly and retry.");
  process.exit(1);
}

let statusOutput;
try {
  statusOutput = execFileSync("supabase", ["status", "-o", "env"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
} catch {
  console.error("Start the local stack with `npm run db:start`, then run this setup again.");
  process.exit(1);
}

const local = Object.fromEntries(
  statusOutput
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Z0-9_]+)="(.*)"$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2]]),
);

if (!local.API_URL || !local.DB_URL || !(local.PUBLISHABLE_KEY || local.ANON_KEY)) {
  console.error("Supabase status did not return the local API, database and publishable key.");
  process.exit(1);
}

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const privatePem = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
const publicPem = publicKey.export({ format: "pem", type: "spki" }).toString();
const keyId = `local-${new Date().toISOString().slice(0, 10)}`;

let contents = readFileSync(template, "utf8");
function setValue(name, value, singleQuoted = false) {
  const serialized = singleQuoted ? `'${value}'` : JSON.stringify(value);
  const re = new RegExp(`^${name}=.*$`, "m");
  if (!re.test(contents)) throw new Error(`Missing ${name} in .env.example`);
  contents = contents.replace(re, `${name}=${serialized}`);
}

setValue("SUPABASE_URL", local.API_URL);
setValue("SUPABASE_PUBLISHABLE_KEY", local.PUBLISHABLE_KEY || local.ANON_KEY);
if (local.SERVICE_ROLE_KEY) setValue("SUPABASE_SERVICE_ROLE_KEY", local.SERVICE_ROLE_KEY);
setValue("DATABASE_URL", local.DB_URL);
setValue("AUTH_FLOW_HMAC_SECRET", randomBytes(48).toString("base64url"));
setValue("PRACTICE_API_SECRET", randomBytes(48).toString("base64url"));
setValue("REALTIME_REDIS_KEY_SECRET", randomBytes(48).toString("base64url"));
setValue("REALTIME_JWS_PRIVATE_KEY", privatePem.replace(/\n/g, "\\n"), true);
setValue(
  "REALTIME_JWS_PUBLIC_KEYS",
  JSON.stringify({ [keyId]: publicPem.replace(/\n/g, "\\n") }),
  true,
);
setValue("REALTIME_JWS_KEY_ID", keyId);

writeFileSync(target, contents, { encoding: "utf8", mode: 0o600, flag: "wx" });
console.log("Created .env.local with local Supabase values, independent secrets and an Ed25519 key pair.");
console.log(`Mailpit: ${local.MAILPIT_URL ?? "see `supabase status`"}`);
