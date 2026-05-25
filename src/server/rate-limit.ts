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

function blocked(
  scope: "user" | "global",
  res: RateLimiterRes,
): RateLimitResult {
  const secondsUntilReset = Math.ceil(res.msBeforeNext / 1000);
  // Never tell the caller to retry in 0s — round any sub-second wait up to 1.
  const retryAfter = Math.max(secondsUntilReset, 1);
  return { ok: false, scope, retryAfter };
}

export async function checkRemoveCcRateLimit(
  userId: number,
): Promise<RateLimitResult> {
  const userKey = String(userId);

  try {
    await perUser.consume(userKey);
  } catch (res) {
    if (res instanceof RateLimiterRes) return blocked("user", res);
    throw res;
  }

  try {
    await global.consume(GLOBAL_KEY);
  } catch (res) {
    if (res instanceof RateLimiterRes) {
      // The user's point was already consumed above, but the request never
      // ran — refund it so they aren't blocked again by their own limit when
      // they retry after the global window resets.
      await perUser.reward(userKey, 1);
      return blocked("global", res);
    }
    throw res;
  }

  return { ok: true };
}
