import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import KeyvSqlite from "@keyv/sqlite";
import Keyv from "keyv";

// @keyv/sqlite creates the .sqlite file on first write but not its parent
// directory, so we ensure ./data exists on boot. If startup ever grows past
// this single guard, lift it into Next's instrumentation.ts 
const dataDir = path.join(process.cwd(), "data");
mkdirSync(dataDir, { recursive: true });

const NAMESPACE = "zendesk-cache";

export const cache = new Keyv({
  store: new KeyvSqlite(`sqlite://${path.join(dataDir, "cache.sqlite")}`),
  namespace: NAMESPACE,
});

export async function cacheGet<T>(key: string): Promise<T | undefined> {
  return cache.get<T>(key);
}

export async function cacheSet<T>(
  key: string,
  value: T,
  ttlMs: number,
): Promise<void> {
  await cache.set(key, value, ttlMs);
}

export async function cacheInvalidate(key: string): Promise<void> {
  await cache.delete(key);
}

export async function cacheInvalidatePrefix(prefix: string): Promise<void> {
  // @keyv/sqlite implements the iterator; Keyv types it as optional.
  const iterator = cache.iterator?.(NAMESPACE);
  if (!iterator) return;
  for await (const [key] of iterator) {
    if (typeof key === "string" && key.startsWith(prefix)) {
      await cache.delete(key);
    }
  }
}
