// Real-time cloud sync layer.
//
// Every page that imports this module (via `startCloudSync()`) listens to
// localStorage writes for whitelisted keys, pushes them to the
// /api/sync Netlify function, and pulls remote updates on a fast polling
// loop so all devices (admin + buyers) stay in sync within ~2 seconds.
//
// Conflict policy: Last-Writer-Wins by client timestamp. Each push includes
// `v: Date.now()` and the server only overwrites if the incoming `v` is
// greater than the stored one.
//
// Loop protection: when we apply a remote change locally we add the key to
// `suppressNextSave`, so the resulting in-app `pinz:storage` event does NOT
// trigger an echo POST back to the server.
import { STORAGE_EVENT } from "./storage";

export const SYNCED_KEYS: readonly string[] = [
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
const SYNCED_SET = new Set(SYNCED_KEYS);
const ENDPOINT = "/api/sync";
const PUSH_DEBOUNCE_MS = 250;

const lastSeenV: Record<string, number> = {};
const suppressNextSave = new Set<string>();
const pushTimers: Record<string, ReturnType<typeof setTimeout> | undefined> = {};
let started = false;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

async function pushKey(key: string): Promise<void> {
  if (!isBrowser()) return;
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
    /* offline / network error — next pull will reconcile */
  }
}

function schedulePush(key: string): void {
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
  } catch {
    /* offline */
  }
}

/**
 * Start the cross-device sync loop. Safe to call multiple times — the
 * second call is a no-op. Returns a function that stops the sync.
 */
export function startCloudSync(intervalMs = 2000): () => void {
  if (!isBrowser() || started) return () => {};
  started = true;

  // First, push current local snapshot for any whitelisted key that has a
  // value. The server will keep the newer record if one already exists.
  for (const k of SYNCED_KEYS) {
    if (localStorage.getItem(k) !== null) schedulePush(k);
  }
  // Pull remote state immediately, then on an interval.
  pullAll();

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
  // Native cross-tab storage event (other tabs in the same browser).
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
