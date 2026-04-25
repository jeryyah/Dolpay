interface Env {
  STORE: KVNamespace;
}

interface ChatMessage {
  id: string;
  from: "user" | "admin";
  text: string;
  at: string;
  read?: boolean;
}
type ChatMap = Record<string, ChatMessage[]>;

const CHAT_KEY = "chat:data";

const JSON_HEADERS: Record<string, string> = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store, must-revalidate",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "access-control-allow-headers": "content-type",
};

function rid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

async function loadMap(env: Env): Promise<ChatMap> {
  try {
    const raw = (await env.STORE.get(CHAT_KEY, "json")) as ChatMap | null;
    return raw || {};
  } catch {
    return {};
  }
}

async function saveMap(env: Env, m: ChatMap): Promise<void> {
  await env.STORE.put(CHAT_KEY, JSON.stringify(m));
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: JSON_HEADERS });
  }

  try {
    if (request.method === "GET") {
      const map = await loadMap(env);
      return new Response(JSON.stringify(map), { headers: JSON_HEADERS });
    }

    if (request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as {
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
      const map = await loadMap(env);
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
      await saveMap(env, map);
      return new Response(JSON.stringify({ message: msg, map }), {
        headers: JSON_HEADERS,
      });
    }

    if (request.method === "DELETE") {
      const body = (await request.json().catch(() => ({}))) as {
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
      const map = await loadMap(env);
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
      await saveMap(env, map);
      return new Response(JSON.stringify({ map }), { headers: JSON_HEADERS });
    }

    if (request.method === "PATCH") {
      const body = (await request.json().catch(() => ({}))) as {
        userId?: string;
        side?: "user" | "admin";
      };
      if (!body.userId || !body.side) {
        return new Response(JSON.stringify({ error: "missing fields" }), {
          status: 400,
          headers: JSON_HEADERS,
        });
      }
      const map = await loadMap(env);
      const cur = map[body.userId] || [];
      map[body.userId] = cur.map((m) =>
        m.from !== body.side ? { ...m, read: true } : m,
      );
      await saveMap(env, map);
      return new Response(JSON.stringify({ map }), { headers: JSON_HEADERS });
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
