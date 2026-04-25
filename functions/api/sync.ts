interface Env {
  STORE: KVNamespace;
}

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

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
};

interface SyncRecord {
  value: string | null;
  v: number;
}

const SYNC_PREFIX = "sync:";

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method === "GET") {
    const out: Record<string, SyncRecord> = {};
    await Promise.all(
      Array.from(ALLOWED_KEYS).map(async (k) => {
        try {
          const blob = (await env.STORE.get(SYNC_PREFIX + k, "json")) as
            | SyncRecord
            | null;
          if (blob && typeof blob.v === "number") out[k] = blob;
        } catch {
          /* ignore */
        }
      }),
    );
    return new Response(JSON.stringify(out), { headers: corsHeaders });
  }

  if (request.method === "POST") {
    let body: {
      key?: string;
      value?: unknown;
      v?: number;
    };
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "invalid json" }), {
        status: 400,
        headers: corsHeaders,
      });
    }
    const key = typeof body?.key === "string" ? body.key : "";
    if (!ALLOWED_KEYS.has(key)) {
      return new Response(JSON.stringify({ error: "invalid key" }), {
        status: 400,
        headers: corsHeaders,
      });
    }
    const ts = typeof body.v === "number" ? body.v : Date.now();
    const incomingValue: string | null =
      body.value === null
        ? null
        : typeof body.value === "string"
          ? body.value
          : JSON.stringify(body.value);

    const existing = (await env.STORE.get(SYNC_PREFIX + key, "json")) as
      | SyncRecord
      | null;
    if (existing && existing.v > ts) {
      return new Response(JSON.stringify(existing), { headers: corsHeaders });
    }

    const record: SyncRecord = { value: incomingValue, v: ts };
    await env.STORE.put(SYNC_PREFIX + key, JSON.stringify(record));
    return new Response(JSON.stringify(record), { headers: corsHeaders });
  }

  return new Response(JSON.stringify({ error: "method not allowed" }), {
    status: 405,
    headers: corsHeaders,
  });
};
