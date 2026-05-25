import "server-only";

const WINDOW_MS = 60 * 1000;
const PER_USER_LIMIT = 1;
const GLOBAL_LIMIT = 3;

const buckets = new Map<string, number[]>();

function hit(key: string, limit: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= limit) {
    const retryAfter = Math.ceil((WINDOW_MS - (now - arr[0])) / 1000);
    buckets.set(key, arr);
    return { ok: false, retryAfter: Math.max(retryAfter, 1) };
  }
  arr.push(now);
  buckets.set(key, arr);
  return { ok: true, retryAfter: 0 };
}

export type RateLimitResult =
  | { ok: true }
  | { ok: false; scope: "user" | "global"; retryAfter: number };

export function checkRemoveCcRateLimit(userId: number): RateLimitResult {
  const userHit = hit(`remove-cc:user:${userId}`, PER_USER_LIMIT);
  if (!userHit.ok)
    return { ok: false, scope: "user", retryAfter: userHit.retryAfter };
  const globalHit = hit("remove-cc:global", GLOBAL_LIMIT);
  if (!globalHit.ok) {
    // Roll back the per-user hit so they aren't penalized for a global block.
    const arr = buckets.get(`remove-cc:user:${userId}`) ?? [];
    arr.pop();
    buckets.set(`remove-cc:user:${userId}`, arr);
    return { ok: false, scope: "global", retryAfter: globalHit.retryAfter };
  }
  return { ok: true };
}
