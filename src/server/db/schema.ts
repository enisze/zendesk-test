import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const cacheEntries = sqliteTable("cache_entries", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at").notNull(),
});

export type CacheEntry = typeof cacheEntries.$inferSelect;
export type NewCacheEntry = typeof cacheEntries.$inferInsert;
