import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

const dataDir = path.join(process.cwd(), "data");
mkdirSync(dataDir, { recursive: true });

const sqlite = new Database(path.join(dataDir, "cache.sqlite"));
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });

migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });

export { schema };
