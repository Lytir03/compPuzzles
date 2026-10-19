import "server-only";

import { isProduction } from "./env";
import { hasDistributedRedis, keyedDigest, redisCommand } from "./redis";

type AuthRateLimitRule = { limit: number; windowSeconds: number };

const RULES = {
  "sign-up": { limit: 5, windowSeconds: 60 * 60 },
  "sign-in": { limit: 10, windowSeconds: 15 * 60 },
  resend: { limit: 3, windowSeconds: 60 * 60 },
  forgot: { limit: 3, windowSeconds: 60 * 60 },
  reset: { limit: 5, windowSeconds: 60 * 60 },
  account: { limit: 10, windowSeconds: 60 * 60 },
  ticket: { limit: 30, windowSeconds: 60 },
} satisfies Record<string, AuthRateLimitRule>;

export type AuthRateLimitName = keyof typeof RULES;

const localBuckets = new Map<string, { count: number; expiresAt: number }>();

function allowLocalDevelopment(key: string, rule: AuthRateLimitRule): boolean {
  if (isProduction() || process.env.AUTH_DEV_ALLOW_IN_MEMORY_RATE_LIMIT !== "true") {
    throw new Error("Distributed auth rate limiting is not configured");
  }
  const now = Date.now();
  const bucket = localBuckets.get(key);
  if (!bucket || bucket.expiresAt <= now) {
    localBuckets.set(key, { count: 1, expiresAt: now + rule.windowSeconds * 1000 });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= rule.limit;
}

const FIXED_WINDOW_SCRIPT = [
  "local count = redis.call('INCR', KEYS[1])",
  "if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end",
  "return count",
].join("\n");

async function consume(ruleName: AuthRateLimitName, dimension: string): Promise<boolean> {
  const rule = RULES[ruleName];
  const key = `cp:auth:rl:${ruleName}:${keyedDigest(dimension)}`;
  if (!hasDistributedRedis()) return allowLocalDevelopment(key, rule);
  const result = await redisCommand(["EVAL", FIXED_WINDOW_SCRIPT, 1, key, rule.windowSeconds]);
  return typeof result === "number" && result <= rule.limit;
}

export async function enforceAuthRateLimit(
  ruleName: AuthRateLimitName,
  ip: string,
  identifier?: string,
): Promise<void> {
  const dimensions = [`ip:${ip}`];
  if (identifier) dimensions.push(`identifier:${identifier.trim().toLowerCase()}`);
  const decisions = await Promise.all(dimensions.map((dimension) => consume(ruleName, dimension)));
  if (decisions.some((allowed) => !allowed)) throw new AuthRateLimitError();
}

export class AuthRateLimitError extends Error {
  constructor() {
    super("Auth rate limit exceeded");
    this.name = "AuthRateLimitError";
  }
}
