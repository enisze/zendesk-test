import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "./db";

const { cacheEntries } = schema;

export async function cacheGet<T>(key: string): Promise<T | null> {
  const [row] = await db
    .select()
    .from(cacheEntries)
    .where(eq(cacheEntries.key, key))
    .limit(1);

  if (!row) return null;

  if (row.expiresAt < Date.now()) {
    await db.delete(cacheEntries).where(eq(cacheEntries.key, key));
    return null;
  }

  return JSON.parse(row.value) as T;
}

export async function cacheSet<T>(
  key: string,
  value: T,
  ttlMs: number,
): Promise<void> {
  const entry = {
    key,
    value: JSON.stringify(value),
    expiresAt: Date.now() + ttlMs,
  };

  await db
    .insert(cacheEntries)
    .values(entry)
    .onConflictDoUpdate({
      target: cacheEntries.key,
      set: { value: entry.value, expiresAt: entry.expiresAt },
    });
}

export async function cacheInvalidate(key: string): Promise<void> {
  await db.delete(cacheEntries).where(eq(cacheEntries.key, key));
}
