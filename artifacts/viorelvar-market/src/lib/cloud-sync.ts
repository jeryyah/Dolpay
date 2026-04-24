// Real-time cloud sync layer.
//
// All devices pull a shared snapshot from the /api/sync Netlify function
// every ~2 seconds (and on visibility/focus/online events) so admin
// changes — products, payment settings, prices, coupons, broadcasts, etc.
// — propagate to every connected buyer in near real-time.
//
// Two key categories:
//
//   ADMIN_ONLY_KEYS  – configuration only the admin should ever write.
//                      Non-admin sessions can READ but never PUSH; this
//                      prevents a fresh visitor's seed defaults from
//                      overwriting admin's settings on the server.
//
//   MULTI_WRITER_KEYS – transactional data that any session may write
//                       (placing orders, registering accounts, etc.).
//
// Conflict policy: Last-Writer-Wins by client timestamp. The server only
// overwrites a record if the incoming timestamp `v` is strictly greater
// than the stored one. Loop guard `suppressNextSave` prevents the local
// `pinz:storage` event triggered by an inbound pull from echoing back
// to the server as a redundant POST.
import { STORAGE_EVENT } from "./storage";

const ADMIN_ONLY_KEYS = new Set<string>([
  "pinz_product_overrides",
  "pinz_extra_products",
  "pinz_categories",
  "pinz_publishers",
  "pinz_announcement",
  "pinz_scheduled_announcements",
  "pinz_payment_settings",
  "pinz_coupons",
  "pinz_broadcast",
  "pinz_maintenance",
  "pinz_payment_binance_image",
  "pinz_payment_qris_image",
  "pinz_inapp_notif",
  "pinz_inapp_notifs",
]);

const MULTI_WRITER_KEYS = new Set<string>([
  "pinz_users",
  "pinz_orders",
  "pinz_stock",
  "pinz_stok",
  "pinz_purchase_notifs",
  "pinz_activity_log",
]);

export const SYNCED_KEYS: readonly string[] = [
  ...ADMIN_ONLY_KEYS,
  ...MULTI_WRITER_KEYS,
];
const SYNCED_SET = new Set(SYNCED_KEYS);

const ENDPOINT = "/api/sync";
const PUSH_DEBOUNCE_MS = 250;

const lastSeenV: Record<string, number> = {};
const suppressNextSave = new Set<string>();
const pushTimers: Record<string, ReturnType<typeof setTimeout> | undefined> = {};
let started = false;
let pullSucceeded = false;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function isAdmin(): boolean {
  if (!isBrowser()) return false;
  try {
    const raw = localStorage.getItem("pinz_session");
    if (!raw) return false;
    const u = JSON.parse(raw);
    return u?.role === "admin" || u?.role === "owner";
  } catch {
    return false;
  }
}

function canPush(key: string): boolean {
  if (!SYNCED_SET.has(key)) return false;
  // Admin-only keys may only be pushed by an admin/owner session, so a
  // first-time visitor with seed defaults can never overwrite the
  // canonical config admin has set on the server.
  if (ADMIN_ONLY_KEYS.has(key)) return isAdmin();
  return true;
}

async function pushKey(key: string): Promise<void> {
  if (!isBrowser() || !canPush(key)) return;
  try {
    const value = localStorage.getItem(key);
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value, v: Date.now() }),
    });
    if (!res.ok) return;
    const data = await res.json().catch(() => null);
    if (data && typeof data.v === "number") lastSeenV[key] = data.v;
  } catch {
    /* offline / network — next pull will reconcile */
  }
}

function schedulePush(key: string): void {
  if (!canPush(key)) return;
  if (pushTimers[key]) clearTimeout(pushTimers[key]);
  pushTimers[key] = setTimeout(() => {
    pushTimers[key] = undefined;
    pushKey(key);
  }, PUSH_DEBOUNCE_MS);
}

async function pullAll(): Promise<void> {
  if (!isBrowser()) return;
  try {
    const res = await fetch(ENDPOINT, { cache: "no-store" });
    if (!res.ok) return;
    const world = (await res.json()) as Record<
      string,
      { value: string | null; v: number }
    >;
    for (const k of SYNCED_KEYS) {
      const remote = world?.[k];
      if (!remote || typeof remote.v !== "number") continue;
      if (lastSeenV[k] && remote.v <= lastSeenV[k]) continue;
      lastSeenV[k] = remote.v;
      const localStr = localStorage.getItem(k);
      if (remote.value === localStr) continue;
      // Apply remote change locally without triggering a re-push.
      suppressNextSave.add(k);
      try {
        if (remote.value === null) localStorage.removeItem(k);
        else localStorage.setItem(k, remote.value);
      } catch {
        suppressNextSave.delete(k);
        continue;
      }
      try {
        window.dispatchEvent(
          new CustomEvent(STORAGE_EVENT, {
            detail: { key: k, fromServer: true },
          }),
        );
      } catch {}
    }
    pullSucceeded = true;
  } catch {
    /* offline */
  }
}

/**
 * Pull the server snapshot into localStorage *before* the React app
 * renders, so brand-new visitors see admin's live products / payment
 * settings / prices on first paint instead of stale seed defaults.
 *
 * Resolves when the first pull completes or after `timeoutMs`, whichever
 * comes first. After a successful prime, if the current session is an
 * admin/owner, any whitelisted local key the server is missing is
 * uploaded (one-time bootstrap so the admin's existing local config
 * seeds the server on first deploy).
 */
export async function primeCloudSync(timeoutMs = 1500): Promise<void> {
  if (!isBrowser()) return;
  await Promise.race([
    pullAll(),
    new Promise<void>((r) => setTimeout(r, timeoutMs)),
  ]);
  if (pullSucceeded && isAdmin()) {
    for (const k of SYNCED_KEYS) {
      const local = localStorage.getItem(k);
      if (local !== null && !lastSeenV[k]) schedulePush(k);
    }
  }
}

/**
 * Start the live sync loop. Call once after `primeCloudSync()`. Safe to
 * call multiple times — second call is a no-op. Returns a disposer.
 */
export function startCloudSync(intervalMs = 2000): () => void {
  if (!isBrowser() || started) return () => {};
  started = true;

  const onAppStorage = (e: Event) => {
    const detail = (e as CustomEvent).detail || {};
    const k: string | undefined = detail.key;
    if (!k || !SYNCED_SET.has(k)) return;
    if (suppressNextSave.has(k)) {
      suppressNextSave.delete(k);
      return;
    }
    schedulePush(k);
  };
  const onNativeStorage = (e: StorageEvent) => {
    if (!e.key || !SYNCED_SET.has(e.key)) return;
    if (suppressNextSave.has(e.key)) {
      suppressNextSave.delete(e.key);
      return;
    }
    schedulePush(e.key);
  };

  window.addEventListener(STORAGE_EVENT, onAppStorage);
  window.addEventListener("storage", onNativeStorage);

  const interval = setInterval(pullAll, intervalMs);
  const onVis = () => {
    if (document.visibilityState === "visible") pullAll();
  };
  document.addEventListener("visibilitychange", onVis);
  const onFocus = () => pullAll();
  window.addEventListener("focus", onFocus);
  const onOnline = () => pullAll();
  window.addEventListener("online", onOnline);

  return () => {
    started = false;
    clearInterval(interval);
    window.removeEventListener(STORAGE_EVENT, onAppStorage);
    window.removeEventListener("storage", onNativeStorage);
    document.removeEventListener("visibilitychange", onVis);
    window.removeEventListener("focus", onFocus);
    window.removeEventListener("online", onOnline);
  };
}
