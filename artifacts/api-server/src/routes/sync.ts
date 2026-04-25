// Generic key-value sync store (port of netlify/functions/sync.ts and
// functions/api/sync.ts). One JSON file per whitelisted key on disk.
//
//   GET  /api/sync   -> { [key]: { value, v } }
//   POST /api/sync   { key, value, v? }   (LWW conflict resolution by `v`)

import { Router, type IRouter, type Request, type Response } from "express";
import { getJSON, updateJSON } from "../lib/store";

const ALLOWED_KEYS = new Set<string>([
  "pinz_users",
  "pinz_orders",
  "pinz_stock",
  "pinz_stok",
  "pinz_product_overrides",
  "pinz_extra_products",
  "pinz_categories",
  "pinz_publishers",
  "pinz_announcement",
  "pinz_scheduled_announcements",
  "pinz_payment_settings",
  "pinz_coupons",
  "pinz_broadcast",
  "pinz_activity_log",
  "pinz_maintenance",
  "pinz_payment_binance_image",
  "pinz_payment_qris_image",
  "pinz_inapp_notif",
  "pinz_inapp_notifs",
  "pinz_purchase_notifs",
]);

type SyncRecord = { value: string | null; v: number };

const router: IRouter = Router();

function syncKey(k: string): string {
  return `sync_${k}`;
}

router.get("/sync", async (_req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  const out: Record<string, SyncRecord> = {};
  await Promise.all(
    Array.from(ALLOWED_KEYS).map(async (k) => {
      const rec = await getJSON<SyncRecord>(syncKey(k));
      if (rec && typeof rec.v === "number") out[k] = rec;
    }),
  );
  res.json(out);
});

router.post("/sync", async (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store");
  const body = (req.body || {}) as {
    key?: string;
    value?: unknown;
    v?: number;
  };
  const key = typeof body.key === "string" ? body.key : "";
  if (!ALLOWED_KEYS.has(key)) {
    res.status(400).json({ error: "invalid key" });
    return;
  }
  const ts = typeof body.v === "number" ? body.v : Date.now();
  const incomingValue: string | null =
    body.value === null
      ? null
      : typeof body.value === "string"
        ? body.value
        : JSON.stringify(body.value);

  const stored = await updateJSON<SyncRecord>(syncKey(key), (existing) => {
    if (existing && existing.v > ts) return existing; // LWW: keep newer
    return { value: incomingValue, v: ts };
  });
  res.json(stored);
});

export default router;
