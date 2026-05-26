import "server-only";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { z } from "zod";

const g = globalThis as any;

const perUser: RateLimiterMemory =
  g.__perUser ??= new RateLimiterMemory({ points: 1, duration: 60 });

const globalLimiter: RateLimiterMemory =
  g.__global ??= new RateLimiterMemory({ points: 3, duration: 60 });

const GLOBAL_KEY = "global";

const rejectionSchema = z.object({
  msBeforeNext: z.number(),
});

type Rejection = z.infer<typeof rejectionSchema>;

export type RateLimitResult =
  | { ok: true }
  | { ok: false; scope: "user" | "global"; retryAfter: number };

function blocked(scope: "user" | "global", res: Rejection): RateLimitResult {
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
  } catch (err) {
    const rejection = rejectionSchema.safeParse(err);
    if (rejection.success) return blocked("user", rejection.data);
    throw err;
  }

  try {
    await globalLimiter.consume(GLOBAL_KEY);
  } catch (err) {
    const rejection = rejectionSchema.safeParse(err);
    if (rejection.success) {
      // The user's point was already consumed above, but the request never
      // ran — refund it so they aren't blocked again by their own limit when
      // they retry after the global window resets.
      await perUser.reward(userKey, 1);
      return blocked("global", rejection.data);
    }
    throw err;
  }

  return { ok: true };
}
