// Admin backup/restore endpoint — safety net buat data chat + sync.
//
//   GET  /api/backup                        -> download semua data sebagai JSON
//   POST /api/backup  body: BackupBundle    -> restore semua data
//
// Auth: simple bearer token via env var ADMIN_TOKEN.
//   Header: Authorization: Bearer <ADMIN_TOKEN>
//   Atau query: ?token=<ADMIN_TOKEN>  (biar gampang download via browser)
//
// Kalau ADMIN_TOKEN tidak di-set di env, endpoint return 503 (disabled).

import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { getJSON, setJSON } from "../lib/store";

interface ChatMessage {
  id: string;
  from: "user" | "admin";
  text: string;
  at: string;
  read?: boolean;
}
type ChatMap = Record<string, ChatMessage[]>;
type SyncRecord = { value: string | null; v: number };

const SYNC_KEYS = [
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
];

interface BackupBundle {
  version: 1;
  exportedAt: string;
  chat: ChatMap;
  sync: Record<string, SyncRecord>;
}

const router: IRouter = Router();

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env["ADMIN_TOKEN"];
  if (!expected) {
    res.status(503).json({
      error:
        "backup endpoint disabled — set ADMIN_TOKEN env var on Railway to enable",
    });
    return;
  }
  const auth = req.headers.authorization || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const queryToken = typeof req.query["token"] === "string" ? req.query["token"] : "";
  const provided = bearer || queryToken;
  if (!provided || provided !== expected) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
}

router.get("/backup", requireAdmin, async (_req: Request, res: Response) => {
  const chat = (await getJSON<ChatMap>("chat")) || {};

  const sync: Record<string, SyncRecord> = {};
  await Promise.all(
    SYNC_KEYS.map(async (k) => {
      const rec = await getJSON<SyncRecord>(`sync_${k}`);
      if (rec && typeof rec.v === "number") sync[k] = rec;
    }),
  );

  const bundle: BackupBundle = {
    version: 1,
    exportedAt: new Date().toISOString(),
    chat,
    sync,
  };

  const fname = `dolpay-backup-${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
  res.send(JSON.stringify(bundle, null, 2));
});

router.post("/backup", requireAdmin, async (req: Request, res: Response) => {
  const body = (req.body || {}) as Partial<BackupBundle>;

  if (body.version !== 1) {
    res.status(400).json({ error: "invalid bundle: version must be 1" });
    return;
  }
  if (!body.chat || typeof body.chat !== "object") {
    res.status(400).json({ error: "invalid bundle: missing chat" });
    return;
  }
  if (!body.sync || typeof body.sync !== "object") {
    res.status(400).json({ error: "invalid bundle: missing sync" });
    return;
  }

  let restoredChat = 0;
  let restoredSync = 0;
  const errors: string[] = [];

  // Restore chat
  try {
    await setJSON("chat", body.chat);
    restoredChat = Object.keys(body.chat).length;
  } catch (e) {
    errors.push(`chat: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Restore sync (only allowed keys)
  await Promise.all(
    Object.entries(body.sync).map(async ([k, v]) => {
      if (!SYNC_KEYS.includes(k)) {
        errors.push(`sync key "${k}" rejected (not in allowlist)`);
        return;
      }
      if (!v || typeof v !== "object" || typeof v.v !== "number") {
        errors.push(`sync key "${k}" rejected (invalid record shape)`);
        return;
      }
      try {
        await setJSON(`sync_${k}`, v);
        restoredSync++;
      } catch (e) {
        errors.push(`sync ${k}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }),
  );

  res.json({
    ok: errors.length === 0,
    restoredChatThreads: restoredChat,
    restoredSyncKeys: restoredSync,
    errors,
  });
});

export default router;
