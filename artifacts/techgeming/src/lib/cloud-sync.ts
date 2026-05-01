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
//
// SAFETY GUARDS (added to fix accidental product-wipe bug):
//   1. ADMIN_ONLY_KEYS pushes are BLOCKED until the very first pull from
//      the server succeeds (`pullSucceeded` flag). A fresh admin tab can
//      no longer publish its empty/stale local state before it has
//      learned what the server already holds.
//   2. `pinz_extra_products` pushes are rejected if they would shrink the
//      catalog by more than half compared to what we last saw on the
//      server, OR if they would push an empty list while the server's
//      last known value had items. Prevents a single corrupted/empty
//      tab from wiping the live product catalog for everyone.
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
// Track the length of the array/object we last saw on the server for keys
// that hold list-like data. Used by the catalog wipe guard so we can
// detect when a local push would dramatically shrink the remote list.
const lastSeenItemCount: Record<string, number> = {};
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
  if (ADMIN_ONLY_KEYS.has(key)) {
    if (!isAdmin()) return false;
    // Critical guard: never push admin-only state until we have at least
    // one confirmed pull from the server. Otherwise a fresh admin tab
    // (empty / stale localStorage) could clobber the live catalog the
    // moment it touches anything that triggers a save.
    if (!pullSucceeded) return false;
  }
  return true;
}

/**
 * Count items in a JSON-ish localStorage value. Returns -1 when the
 * value can't be parsed or doesn't look like a list/object — meaning the
 * shrinkage guard should not apply.
 */
function countItems(rawValue: string | null): number {
  if (rawValue == null) return 0;
  try {
    const parsed = JSON.parse(rawValue);
    if (Array.isArray(parsed)) return parsed.length;
    if (parsed && typeof parsed === "object") return Object.keys(parsed).length;
    return -1;
  } catch {
    return -1;
  }
}

/**
 * Anti-wipe guard for catalog-style keys. Returns false if the new local
 * value would dramatically shrink (or empty out) what we last saw on the
 * server, so a corrupted / empty tab cannot wipe the live catalog.
 *
 * Currently applies to: pinz_extra_products, pinz_product_overrides,
 * pinz_categories, pinz_publishers.
 */
function isSafeShrink(key: string, value: string | null): boolean {
  const guardedKeys = new Set([
    "pinz_extra_products",
    "pinz_product_overrides",
    "pinz_categories",
    "pinz_publishers",
  ]);
  if (!guardedKeys.has(key)) return true;
  const remoteCount = lastSeenItemCount[key];
  // No baseline yet — allow (we trust the very first push).
  if (typeof remoteCount !== "number" || remoteCount <= 0) return true;
  const localCount = countItems(value);
  if (localCount < 0) return true; // unparseable — leave alone
  // Block: pushing 0 items while server had items.
  if (localCount === 0 && remoteCount > 0) return false;
  // Block: pushing fewer than half of the items we last saw.
  if (localCount * 2 < remoteCount) return false;
  return true;
}

async function pushKey(key: string): Promise<void> {
  if (!isBrowser() || !canPush(key)) return;
  try {
    const value = localStorage.getItem(key);
    // Anti-wipe guard: refuse to push a value that would dramatically
    // shrink the live catalog. The next pull will reconcile if local
    // really is meant to be empty (admin can use the panel's explicit
    // delete-all flow which performs a fresh push after a reload).
    if (!isSafeShrink(key, value)) {
      console.warn(
        `[cloud-sync] Push for ${key} blocked — local has ` +
        `${countItems(value)} items but server last had ` +
        `${lastSeenItemCount[key]}. Pulling fresh data instead.`,
      );
      // Trigger an immediate pull so the local stale snapshot is
      // overwritten by the canonical server state.
      void pullAll();
      return;
    }
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value, v: Date.now() }),
    });
    if (!res.ok) return;
    const data = await res.json().catch(() => null);
    if (data && typeof data.v === "number") {
      lastSeenV[key] = data.v;
      // The server echoes back the value it actually stored — refresh
      // our shrink-guard baseline with the authoritative item count.
      const storedValue: string | null =
        typeof data.value === "string" ? data.value : null;
      const stored = countItems(storedValue);
      if (stored >= 0) lastSeenItemCount[key] = stored;
    }
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
      // Always refresh the shrink-guard baseline from the server so the
      // anti-wipe check has accurate data even when we skip apply below.
      const remoteCount = countItems(remote.value);
      if (remoteCount >= 0) lastSeenItemCount[k] = remoteCount;
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
 *
 * Bumped from 1500ms → 5000ms because failing to receive the snapshot
 * before render leaves admin sessions vulnerable to the "empty local
 * pushes empty to server" wipe scenario.
 */
export async function primeCloudSync(timeoutMs = 5000): Promise<void> {
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
 * Returns true once the first server pull has completed. UI components
 * (e.g. admin product manager) can use this to render a loading state
 * instead of a misleading "0 products" view when the network is slow.
 */
export function isCloudSyncPrimed(): boolean {
  return pullSucceeded;
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
