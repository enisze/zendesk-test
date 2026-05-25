import "server-only";
import { RateLimiterMemory, RateLimiterRes } from "rate-limiter-flexible";

const perUser = new RateLimiterMemory({
  keyPrefix: "remove-cc:user",
  points: 1,
  duration: 60,
});

const global = new RateLimiterMemory({
  keyPrefix: "remove-cc:global",
  points: 3,
  duration: 60,
});

const GLOBAL_KEY = "global";

export type RateLimitResult =
  | { ok: true }
  | { ok: false; scope: "user" | "global"; retryAfter: number };

function blocked(scope: "user" | "global", res: RateLimiterRes): RateLimitResult {
  return {
    ok: false,
    scope,
    retryAfter: Math.max(1, Math.ceil(res.msBeforeNext / 1000)),
  };
}

export async function checkRemoveCcRateLimit(
  userId: number,
): Promise<RateLimitResult> {
  const userKey = String(userId);

  try {
    await perUser.consume(userKey);
  } catch (res) {
    return blocked("user", res as RateLimiterRes);
  }

  try {
    await global.consume(GLOBAL_KEY);
  } catch (res) {
    // Give the per-user point back so they aren't penalised for global pressure.
    await perUser.reward(userKey, 1);
    return blocked("global", res as RateLimiterRes);
  }

  return { ok: true };
}
