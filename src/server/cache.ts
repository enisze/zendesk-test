import "server-only";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

const dataDir = path.join(process.cwd(), "data");
mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "cache.sqlite"));
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS cache (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );
`);

const selectStmt = db.prepare(
  "SELECT value, expires_at FROM cache WHERE key = ?",
);
const upsertStmt = db.prepare(
  "INSERT INTO cache (key, value, expires_at) VALUES (?, ?, ?) " +
    "ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at",
);
const deleteStmt = db.prepare("DELETE FROM cache WHERE key = ?");

export function cacheGet<T>(key: string): T | null {
  const row = selectStmt.get(key) as
    | { value: string; expires_at: number }
    | undefined;
  if (!row) return null;
  if (row.expires_at < Date.now()) {
    deleteStmt.run(key);
    return null;
  }
  return JSON.parse(row.value) as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  upsertStmt.run(key, JSON.stringify(value), Date.now() + ttlMs);
}

export function cacheInvalidate(key: string): void {
  deleteStmt.run(key);
}
