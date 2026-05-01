import { Router, type IRouter } from "express";
import { db, syncStoreTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/sync", async (req, res) => {
  try {
    const rows = await db.select().from(syncStoreTable);
    const world: Record<string, { value: string | null; v: number }> = {};
    for (const row of rows) {
      world[row.key] = { value: row.value ?? null, v: row.v };
    }
    res.json(world);
  } catch (err) {
    req.log.error({ err }, "sync GET failed");
    res.status(500).json({ error: "internal error" });
  }
});

router.post("/sync", async (req, res) => {
  const { key, value, v } = req.body as { key?: string; value?: string | null; v?: number };

  if (!key || typeof key !== "string") {
    res.status(400).json({ error: "key required" });
    return;
  }
  if (typeof v !== "number") {
    res.status(400).json({ error: "v (timestamp) required" });
    return;
  }

  try {
    const existing = await db
      .select({ v: syncStoreTable.v })
      .from(syncStoreTable)
      .where(eq(syncStoreTable.key, key))
      .limit(1);

    if (existing.length > 0 && existing[0].v >= v) {
      const current = await db
        .select()
        .from(syncStoreTable)
        .where(eq(syncStoreTable.key, key))
        .limit(1);
      res.json({ stored: false, v: current[0].v, value: current[0].value ?? null });
      return;
    }

    const [row] = await db
      .insert(syncStoreTable)
      .values({ key, value: value ?? null, v })
      .onConflictDoUpdate({
        target: syncStoreTable.key,
        set: { value: value ?? null, v },
      })
      .returning();

    res.json({ stored: true, v: row.v, value: row.value ?? null });
  } catch (err) {
    req.log.error({ err }, "sync POST failed");
    res.status(500).json({ error: "internal error" });
  }
});

export default router;
