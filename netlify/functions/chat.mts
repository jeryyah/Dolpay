// Netlify Function: server-side chat backed by Netlify Blobs (KV).
// Sumber kebenaran (source of truth) untuk Live Chat antar perangkat.
// Dipakai oleh `lib/extra-storage.ts` (frontend) — localStorage hanya cache.
//
//   GET    /api/chat                 → seluruh ChatMap (semua thread)
//   POST   /api/chat                 → tambah pesan {userId, from, text}
//   PATCH  /api/chat                 → tandai dibaca {userId, side}
//   DELETE /api/chat                 → reset thread {userId, by, byName?}

import type { Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

interface ChatMessage {
  id: string;
  from: "user" | "admin";
  text: string;
  at: string;
  read?: boolean;
}
type ChatMap = Record<string, ChatMessage[]>;

const STORE_NAME = "viorelvar-chat";
const BLOB_KEY = "data";

function store() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

async function loadMap(): Promise<ChatMap> {
  try {
    const raw = await store().get(BLOB_KEY, { type: "json" });
    return (raw as ChatMap) || {};
  } catch {
    return {};
  }
}

async function saveMap(m: ChatMap): Promise<void> {
  await store().setJSON(BLOB_KEY, m);
}

function rid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store, must-revalidate",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "access-control-allow-headers": "content-type",
};

export default async (req: Request, _ctx: Context): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: JSON_HEADERS });
  }

  try {
    if (req.method === "GET") {
      const map = await loadMap();
      return new Response(JSON.stringify(map), { headers: JSON_HEADERS });
    }

    if (req.method === "POST") {
      const body = (await req.json().catch(() => ({}))) as {
        userId?: string;
        from?: "user" | "admin";
        text?: string;
      };
      if (!body.userId || !body.from || !body.text?.trim()) {
        return new Response(JSON.stringify({ error: "missing fields" }), {
          status: 400,
          headers: JSON_HEADERS,
        });
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
      return new Response(JSON.stringify({ message: msg, map }), {
        headers: JSON_HEADERS,
      });
    }

    if (req.method === "DELETE") {
      // Reset thread chat user — pesan dikosongkan total. Sebuah pesan sistem
      // (from "admin") otomatis dimasukkan supaya kedua sisi tahu chat sudah
      // direset, dan supaya thread tetap muncul di inbox admin.
      const body = (await req.json().catch(() => ({}))) as {
        userId?: string;
        by?: "user" | "admin";
        byName?: string;
      };
      if (!body.userId) {
        return new Response(JSON.stringify({ error: "missing userId" }), {
          status: 400,
          headers: JSON_HEADERS,
        });
      }
      const map = await loadMap();
      const who = body.by === "user" ? "pengguna" : "admin";
      const sysText =
        body.by === "user"
          ? `[Sistem] Riwayat chat direset oleh pengguna${body.byName ? ` (@${body.byName})` : ""}.`
          : `[Sistem] Riwayat chat direset oleh admin${body.byName ? ` (@${body.byName})` : ""}.`;
      void who;
      map[body.userId] = [
        {
          id: rid(),
          from: "admin",
          text: sysText,
          at: new Date().toISOString(),
          read: body.by === "admin", // kalau admin sendiri yg reset, tdk perlu unread badge
        },
      ];
      await saveMap(map);
      return new Response(JSON.stringify({ map }), { headers: JSON_HEADERS });
    }

    if (req.method === "PATCH") {
      const body = (await req.json().catch(() => ({}))) as {
        userId?: string;
        side?: "user" | "admin";
      };
      if (!body.userId || !body.side) {
        return new Response(JSON.stringify({ error: "missing fields" }), {
          status: 400,
          headers: JSON_HEADERS,
        });
      }
      const map = await loadMap();
      const cur = map[body.userId] || [];
      map[body.userId] = cur.map((m) =>
        m.from !== body.side ? { ...m, read: true } : m,
      );
      await saveMap(map);
      return new Response(JSON.stringify({ map: map }), { headers: JSON_HEADERS });
    }

    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405,
      headers: JSON_HEADERS,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: JSON_HEADERS,
    });
  }
};

export const config = {
  path: "/api/chat",
};
