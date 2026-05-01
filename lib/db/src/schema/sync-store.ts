import { pgTable, text, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const syncStoreTable = pgTable("sync_store", {
  key: text("key").primaryKey(),
  value: text("value"),
  v: bigint("v", { mode: "number" }).notNull().default(0),
});

export const insertSyncStoreSchema = createInsertSchema(syncStoreTable);
export type InsertSyncStore = z.infer<typeof insertSyncStoreSchema>;
export type SyncStore = typeof syncStoreTable.$inferSelect;
