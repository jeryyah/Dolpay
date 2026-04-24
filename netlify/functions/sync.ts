import type { Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

// Generic key-value real-time sync store backed by Netlify Blobs.
// One blob per whitelisted key — strong consistency so that all devices
// (admin + buyers) see the latest snapshot within one polling cycle.
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
};

type Record = { value: string | null; v: number };

export default async (req: Request, _ctx: Context): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const store = getStore({ name: "viorelvar-sync", consistency: "strong" });

  if (req.method === "GET") {
    const out: { [k: string]: Record } = {};
    await Promise.all(
      Array.from(ALLOWED_KEYS).map(async (k) => {
        try {
          const blob = (await store.get(k, { type: "json" })) as Record | null;
          if (blob && typeof blob.v === "number") out[k] = blob;
        } catch {
          /* ignore individual key errors */
        }
      }),
    );
    return new Response(JSON.stringify(out), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  if (req.method === "POST") {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "invalid json" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const key = typeof body?.key === "string" ? body.key : "";
    if (!ALLOWED_KEYS.has(key)) {
      return new Response(JSON.stringify({ error: "invalid key" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const ts = typeof body.v === "number" ? body.v : Date.now();
    const incomingValue: string | null =
      body.value === null
        ? null
        : typeof body.value === "string"
          ? body.value
          : JSON.stringify(body.value);

    // LWW conflict resolution: if existing record has a higher
    // timestamp, return the existing record without overwriting.
    const existing = (await store.get(key, { type: "json" })) as Record | null;
    if (existing && existing.v > ts) {
      return new Response(JSON.stringify(existing), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const record: Record = { value: incomingValue, v: ts };
    await store.setJSON(key, record);
    return new Response(JSON.stringify(record), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
};

export const config = { path: "/api/sync" };
