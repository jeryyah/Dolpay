// Live chat backend (port of netlify/functions/chat.ts and functions/api/chat.ts).
// Storage: file-based JSON via lib/store.ts.
//
//   GET    /api/chat   -> entire ChatMap
//   POST   /api/chat   -> push message {userId, from, text}
//   PATCH  /api/chat   -> mark thread read {userId, side}
//   DELETE /api/chat   -> reset thread {userId, by, byName?}

import { Router, type IRouter, type Request, type Response } from "express";
import { getJSON, setJSON } from "../lib/store";

interface ChatMessage {
  id: string;
  from: "user" | "admin";
  text: string;
  at: string;
  read?: boolean;
}
type ChatMap = Record<string, ChatMessage[]>;

const STORE_KEY = "chat";

async function loadMap(): Promise<ChatMap> {
  return (await getJSON<ChatMap>(STORE_KEY)) || {};
}

async function saveMap(m: ChatMap): Promise<void> {
  await setJSON(STORE_KEY, m);
}

function rid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

const router: IRouter = Router();

router.get("/chat", async (_req: Request, res: Response) => {
  res.set("Cache-Control", "no-store, must-revalidate");
  const map = await loadMap();
  res.json(map);
});

router.post("/chat", async (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store, must-revalidate");
  const body = (req.body || {}) as {
    userId?: string;
    from?: "user" | "admin";
    text?: string;
  };
  if (!body.userId || !body.from || !body.text?.trim()) {
    res.status(400).json({ error: "missing fields" });
    return;
  }
  const map = await loadMap();
  const cur = map[body.userId] || [];
  const msg: ChatMessage = {
    id: rid(),
    from: body.from,
    text: body.text.trim().slice(0, 2000),
    at: new Date().toISOString(),
    read: false,
  };
  cur.push(msg);
  map[body.userId] = cur.slice(-200);
  await saveMap(map);
  res.json({ message: msg, map });
});

router.patch("/chat", async (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store, must-revalidate");
  const body = (req.body || {}) as {
    userId?: string;
    side?: "user" | "admin";
  };
  if (!body.userId || !body.side) {
    res.status(400).json({ error: "missing fields" });
    return;
  }
  const map = await loadMap();
  const cur = map[body.userId] || [];
  map[body.userId] = cur.map((m) =>
    m.from !== body.side ? { ...m, read: true } : m,
  );
  await saveMap(map);
  res.json({ map });
});

router.delete("/chat", async (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store, must-revalidate");
  const body = (req.body || {}) as {
    userId?: string;
    by?: "user" | "admin";
    byName?: string;
  };
  if (!body.userId) {
    res.status(400).json({ error: "missing userId" });
    return;
  }
  const map = await loadMap();
  const sysText =
    body.by === "user"
      ? `[Sistem] Riwayat chat direset oleh pengguna${body.byName ? ` (@${body.byName})` : ""}.`
      : `[Sistem] Riwayat chat direset oleh admin${body.byName ? ` (@${body.byName})` : ""}.`;
  map[body.userId] = [
    {
      id: rid(),
      from: "admin",
      text: sysText,
      at: new Date().toISOString(),
      read: body.by === "admin",
    },
  ];
  await saveMap(map);
  res.json({ map });
});

export default router;
