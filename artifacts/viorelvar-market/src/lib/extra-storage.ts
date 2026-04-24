// ────────────────────────────────────────────────────────────────────────────
// Extra storage helpers — semua fitur tambahan disatukan di sini supaya
// storage.ts tetap fokus pada core.
// ────────────────────────────────────────────────────────────────────────────
import { getUsers, saveUsers, getOrders, saveOrders, broadcastStorageChange, type User, type Order, type UserRole } from "./storage";

// ─── Reseller / Pro / Elite Tier System ────────────────────────────────────
export type TierRole = "reseller" | "pro" | "elite";

export interface TierInfo {
  key: TierRole;
  label: string;
  discountPct: number;     // applied to product price at checkout
  badgeClass: string;      // tailwind classes for the role badge
  perks: string[];
}

export const TIERS: Record<TierRole, TierInfo> = {
  reseller: {
    key: "reseller",
    label: "Reseller",
    discountPct: 10,
    badgeClass: "bg-sky-500/15 text-sky-300 border border-sky-400/30",
    perks: [
      "Diskon 10% untuk semua produk",
      "Badge Reseller di profil",
      "Akses grup khusus reseller",
    ],
  },
  pro: {
    key: "pro",
    label: "Pro",
    discountPct: 15,
    badgeClass: "bg-amber-500/15 text-amber-300 border border-amber-400/30",
    perks: [
      "Diskon 15% untuk semua produk",
      "Verifikasi pembayaran prioritas",
      "Akses early-access produk baru",
    ],
  },
  elite: {
    key: "elite",
    label: "Elite",
    discountPct: 25,
    badgeClass: "bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-400/30",
    perks: [
      "Diskon 25% untuk semua produk",
      "Unlimited replace-key garansi",
      "Live chat prioritas 24/7",
      "Akses bulk pricing & API reseller",
    ],
  },
};

/** Returns badge label + tailwind classes for any role (used across UI). */
export function getRoleBadge(role: UserRole): { label: string; className: string } {
  switch (role) {
    case "owner":    return { label: "OWNER",    className: "bg-purple-400/15 text-purple-300 border border-purple-400/30" };
    case "admin":    return { label: "ADMIN",    className: "bg-rose-400/15 text-rose-300 border border-rose-400/30" };
    case "elite":    return { label: "ELITE",    className: TIERS.elite.badgeClass };
    case "pro":      return { label: "PRO",      className: TIERS.pro.badgeClass };
    case "reseller": return { label: "RESELLER", className: TIERS.reseller.badgeClass };
    default:         return { label: "USER",     className: "bg-muted text-muted-foreground" };
  }
}

/** Discount percent for a given user role; 0 for non-tier roles. */
export function getTierDiscountPct(role: UserRole | undefined): number {
  if (!role) return 0;
  if (role === "reseller" || role === "pro" || role === "elite") return TIERS[role].discountPct;
  return 0;
}

/** Owner-only: change a user's role. */
export function setUserRole(userId: string, role: UserRole, actor?: string): User | null {
  const u = patchUser(userId, { role } as any);
  if (u) pushActivity("admin", `Role @${u.username} di-set ke ${role}`, { actor });
  return u;
}

/** Spending stats used to drive auto-grant rules. */
export function getUserSpending(userId: string): { verifiedCount: number; verifiedTotalIDR: number } {
  const orders = getOrders().filter(
    (o) => o.userId === userId && (o.status === "verified" || o.status === "paid"),
  );
  const total = orders.reduce((s, o) => s + (o.finalPriceIDR ?? o.variantPrice ?? 0), 0);
  return { verifiedCount: orders.length, verifiedTotalIDR: total };
}

/** Auto-grant thresholds (editable here in one place). */
export const AUTO_GRANT_RULES = {
  reseller: { minOrders: 3,  minSpendIDR: 200_000   },
  pro:      { minOrders: 5,  minSpendIDR: 500_000   },
  elite:    { minOrders: 25, minSpendIDR: 5_000_000 },
};

/**
 * Scan all regular users and promote any that meet a tier's threshold.
 * Returns the list of users that were upgraded.
 * Never downgrades, never touches admin/owner.
 */
export function autoGrantTier(target: TierRole, actor?: string): User[] {
  const rule = AUTO_GRANT_RULES[target];
  const order: UserRole[] = ["user", "reseller", "pro", "elite"];
  const targetIdx = order.indexOf(target);
  const upgraded: User[] = [];
  for (const u of getUsers()) {
    if (u.role === "owner" || u.role === "admin") continue;
    const currentIdx = order.indexOf(u.role);
    if (currentIdx >= targetIdx) continue; // already same or higher tier
    const stats = getUserSpending(u.id);
    if (stats.verifiedCount >= rule.minOrders || stats.verifiedTotalIDR >= rule.minSpendIDR) {
      const updated = setUserRole(u.id, target, actor);
      if (updated) {
        upgraded.push(updated);
        pushNotif(
          u.id,
          "success",
          `Selamat! Kamu naik ke tier ${TIERS[target].label}`,
          `Sekarang kamu mendapat diskon ${TIERS[target].discountPct}% otomatis di setiap pembelian.`,
        );
      }
    }
  }
  return upgraded;
}


// ─── Maintenance Mode ──────────────────────────────────────────────────────
export interface MaintenanceConfig {
  enabled: boolean;
  message: string;
  until?: string; // ISO
}
const MAINT_KEY = "pinz_maintenance";
const DEFAULT_MAINT: MaintenanceConfig = {
  enabled: false,
  message: "Sistem sedang dalam pemeliharaan. Silakan kembali sebentar lagi.",
};
export function getMaintenance(): MaintenanceConfig {
  try { return { ...DEFAULT_MAINT, ...JSON.parse(localStorage.getItem(MAINT_KEY) || "{}") }; }
  catch { return DEFAULT_MAINT; }
}
export function setMaintenance(cfg: Partial<MaintenanceConfig>) {
  const merged = { ...getMaintenance(), ...cfg };
  localStorage.setItem(MAINT_KEY, JSON.stringify(merged));
  broadcastStorageChange(MAINT_KEY);
  pushActivity("system", `Maintenance ${merged.enabled ? "ON" : "OFF"}`);
  return merged;
}

// ─── Scheduled Announcements ───────────────────────────────────────────────
export interface ScheduledAnnouncement {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "success" | "danger";
  startAt: string; // ISO
  endAt: string;   // ISO
  createdAt: string;
}
const SCHED_KEY = "pinz_scheduled_announcements";
export function getScheduledAnnouncements(): ScheduledAnnouncement[] {
  try { return JSON.parse(localStorage.getItem(SCHED_KEY) || "[]"); } catch { return []; }
}
export function saveScheduledAnnouncements(list: ScheduledAnnouncement[]) {
  localStorage.setItem(SCHED_KEY, JSON.stringify(list));
  broadcastStorageChange(SCHED_KEY);
}
export function addScheduledAnnouncement(data: Omit<ScheduledAnnouncement, "id" | "createdAt">) {
  const all = getScheduledAnnouncements();
  const next: ScheduledAnnouncement = { ...data, id: rid(), createdAt: new Date().toISOString() };
  all.push(next);
  saveScheduledAnnouncements(all);
  pushActivity("system", `Pengumuman terjadwal "${next.title}" dibuat`);
  return next;
}
export function deleteScheduledAnnouncement(id: string) {
  saveScheduledAnnouncements(getScheduledAnnouncements().filter((s) => s.id !== id));
}
export function getActiveScheduledAnnouncements(): ScheduledAnnouncement[] {
  const now = Date.now();
  return getScheduledAnnouncements().filter(
    (s) => new Date(s.startAt).getTime() <= now && new Date(s.endAt).getTime() >= now,
  );
}

// ─── Activity Log ──────────────────────────────────────────────────────────
export interface ActivityEntry {
  id: string;
  category: "auth" | "order" | "user" | "admin" | "system" | "payment";
  message: string;
  actor?: string;     // username
  meta?: Record<string, any>;
  at: string;         // ISO
}
const ACTIVITY_KEY = "pinz_activity_log";
const ACTIVITY_MAX = 500;
export function getActivityLog(): ActivityEntry[] {
  try { return JSON.parse(localStorage.getItem(ACTIVITY_KEY) || "[]"); } catch { return []; }
}
export function pushActivity(
  category: ActivityEntry["category"],
  message: string,
  meta?: { actor?: string } & Record<string, any>,
) {
  const all = getActivityLog();
  all.unshift({
    id: rid(), category, message,
    actor: meta?.actor, meta,
    at: new Date().toISOString(),
  });
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify(all.slice(0, ACTIVITY_MAX)));
  broadcastStorageChange(ACTIVITY_KEY);
}
export function clearActivityLog() { localStorage.removeItem(ACTIVITY_KEY); broadcastStorageChange(ACTIVITY_KEY); }

// ─── Banned Users + Tags + Bonus + Devices ────────────────────────────────
export interface UserExt {
  banned?: boolean;
  banReason?: string;
  bannedAt?: string;
  tags?: string[];
  balance?: number;        // bonus credit IDR
  bonusLog?: { id: string; amount: number; reason: string; at: string }[];
  streak?: { last: string; current: number; longest: number; total: number };
  referralCode?: string;
  referredBy?: string;     // referralCode of referrer
  devices?: string[];      // device fingerprints used
  twoFA?: boolean;
}
// We extend User in-place by writing extra fields onto it (TS-relaxed).
export function patchUser(userId: string, patch: Partial<User & UserExt>): User | null {
  const all = getUsers();
  const idx = all.findIndex((u) => u.id === userId);
  if (idx < 0) return null;
  all[idx] = { ...all[idx], ...patch } as User;
  saveUsers(all);
  return all[idx];
}
export function getUserExt(userId: string): (User & UserExt) | null {
  return (getUsers().find((u) => u.id === userId) as (User & UserExt)) || null;
}

export function banUser(userId: string, reason: string, actor?: string) {
  patchUser(userId, { banned: true, banReason: reason, bannedAt: new Date().toISOString() } as any);
  pushActivity("user", `User ${userId} di-ban: ${reason}`, { actor });
}
export function unbanUser(userId: string, actor?: string) {
  patchUser(userId, { banned: false, banReason: undefined } as any);
  pushActivity("user", `User ${userId} di-unban`, { actor });
}
export function setUserTags(userId: string, tags: string[]) {
  patchUser(userId, { tags } as any);
}
export function giveBonus(userId: string, amount: number, reason: string, actor?: string) {
  const u = getUserExt(userId);
  if (!u) return null;
  const bal = (u.balance || 0) + amount;
  const log = [...(u.bonusLog || []), { id: rid(), amount, reason, at: new Date().toISOString() }];
  patchUser(userId, { balance: bal, bonusLog: log } as any);
  pushActivity("user", `Bonus ${amount} ke ${u.username}: ${reason}`, { actor });
  pushNotif(userId, "success", "Bonus diterima!", `Kamu menerima Rp${amount.toLocaleString("id-ID")} — ${reason}`);
  return { ok: true, balance: bal };
}

// ─── Daily Login Streak ────────────────────────────────────────────────────
export function todayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}
/** Catat login hari ini, return streak baru (current). */
export function recordLogin(userId: string): { current: number; longest: number; isNewDay: boolean; bonus?: number } {
  const u = getUserExt(userId);
  if (!u) return { current: 0, longest: 0, isNewDay: false };
  const today = todayKey();
  const s = u.streak || { last: "", current: 0, longest: 0, total: 0 };
  if (s.last === today) return { current: s.current, longest: s.longest, isNewDay: false };
  const yesterday = todayKey(new Date(Date.now() - 86_400_000));
  let current = s.last === yesterday ? s.current + 1 : 1;
  const longest = Math.max(s.longest, current);
  const total = (s.total || 0) + 1;
  patchUser(userId, { streak: { last: today, current, longest, total } } as any);
  // Bonus tiap kelipatan 7 hari berturut.
  let bonus: number | undefined;
  if (current > 0 && current % 7 === 0) {
    bonus = current * 1000;
    giveBonus(userId, bonus, `Bonus streak ${current} hari beruntun`);
  }
  pushActivity("auth", `Login streak ${current} hari`, { actor: u.username });
  return { current, longest, isNewDay: true, bonus };
}

// ─── Wishlist (per user) ───────────────────────────────────────────────────
const WL_KEY = "pinz_wishlist";
type WLMap = Record<string, string[]>;
function getWLMap(): WLMap {
  try { return JSON.parse(localStorage.getItem(WL_KEY) || "{}"); } catch { return {}; }
}
function saveWLMap(m: WLMap) { localStorage.setItem(WL_KEY, JSON.stringify(m)); }
export function getWishlist(userId: string): string[] {
  return getWLMap()[userId] || [];
}
export function isWishlisted(userId: string, productId: string): boolean {
  return getWishlist(userId).includes(productId);
}
export function toggleWishlist(userId: string, productId: string): boolean {
  const m = getWLMap();
  const cur = m[userId] || [];
  const idx = cur.indexOf(productId);
  if (idx >= 0) { cur.splice(idx, 1); m[userId] = cur; saveWLMap(m); return false; }
  cur.push(productId); m[userId] = cur; saveWLMap(m);
  return true;
}

// ─── In-App Notifications ──────────────────────────────────────────────────
export interface AppNotif {
  id: string;
  type: "info" | "success" | "warning" | "danger";
  title: string;
  message: string;
  read: boolean;
  link?: string;
  createdAt: string;
}
const NOTIF_KEY = "pinz_inapp_notifs";
type NotifMap = Record<string, AppNotif[]>;
function getNotifMap(): NotifMap {
  try { return JSON.parse(localStorage.getItem(NOTIF_KEY) || "{}"); } catch { return {}; }
}
function saveNotifMap(m: NotifMap) { localStorage.setItem(NOTIF_KEY, JSON.stringify(m)); broadcastStorageChange(NOTIF_KEY); }
export function getUserNotifs(userId: string): AppNotif[] {
  return (getNotifMap()[userId] || []).slice(0, 100);
}
export function getUnreadCount(userId: string): number {
  return getUserNotifs(userId).filter((n) => !n.read).length;
}
export function pushNotif(
  userId: string,
  type: AppNotif["type"], title: string, message: string, link?: string,
) {
  const m = getNotifMap();
  const cur = m[userId] || [];
  cur.unshift({ id: rid(), type, title, message, link, read: false, createdAt: new Date().toISOString() });
  m[userId] = cur.slice(0, 100);
  saveNotifMap(m);
  try { window.dispatchEvent(new CustomEvent("pinz_inapp_notif", { detail: { userId } })); } catch {}
}
export function markNotifRead(userId: string, notifId: string) {
  const m = getNotifMap();
  const cur = m[userId] || [];
  const idx = cur.findIndex((n) => n.id === notifId);
  if (idx >= 0) { cur[idx].read = true; m[userId] = cur; saveNotifMap(m); }
}
export function markAllNotifRead(userId: string) {
  const m = getNotifMap();
  m[userId] = (m[userId] || []).map((n) => ({ ...n, read: true }));
  saveNotifMap(m);
}
export function clearNotifs(userId: string) {
  const m = getNotifMap();
  delete m[userId]; saveNotifMap(m);
}

// ─── Referral ──────────────────────────────────────────────────────────────
const REF_BONUS = 25_000;
function genRefCode(username: string): string {
  return `${username.slice(0, 4).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}
export function getOrCreateReferralCode(userId: string): string {
  const u = getUserExt(userId);
  if (!u) return "";
  if (u.referralCode) return u.referralCode;
  const code = genRefCode(u.username);
  patchUser(userId, { referralCode: code } as any);
  return code;
}
export function applyReferralCode(newUserId: string, refCode: string): { ok: boolean; reason?: string } {
  if (!refCode.trim()) return { ok: false, reason: "Kode referral kosong." };
  const code = refCode.trim().toUpperCase();
  const all = getUsers() as (User & UserExt)[];
  const inviter = all.find((u) => u.referralCode?.toUpperCase() === code);
  if (!inviter) return { ok: false, reason: "Kode referral tidak ditemukan." };
  const newU = all.find((u) => u.id === newUserId) as (User & UserExt) | undefined;
  if (!newU) return { ok: false, reason: "User tidak ditemukan." };
  if (newU.id === inviter.id) return { ok: false, reason: "Tidak bisa pakai kode sendiri." };
  if (newU.referredBy) return { ok: false, reason: "Sudah pernah pakai kode referral." };
  patchUser(newUserId, { referredBy: code } as any);
  giveBonus(newUserId, REF_BONUS, "Bonus referral baru");
  giveBonus(inviter.id, REF_BONUS, `Mengundang ${newU.username}`);
  pushNotif(inviter.id, "success", "Referral baru!", `${newU.username} menggunakan kode kamu. +Rp${REF_BONUS.toLocaleString("id-ID")}`);
  return { ok: true };
}
export function getReferralStats(userId: string): {
  code: string; invitedCount: number; totalEarned: number; invited: { username: string; at: string }[];
} {
  const code = getOrCreateReferralCode(userId);
  const all = getUsers() as (User & UserExt)[];
  const invited = all
    .filter((u) => u.referredBy?.toUpperCase() === code.toUpperCase())
    .map((u) => ({ username: u.username, at: u.createdAt }));
  const me = all.find((u) => u.id === userId);
  const totalEarned = (me?.bonusLog || [])
    .filter((b) => b.reason.startsWith("Mengundang"))
    .reduce((s, b) => s + b.amount, 0);
  return { code, invitedCount: invited.length, totalEarned, invited };
}

// ─── 2FA Owner (simple OTP via localStorage shown in Admin) ───────────────
// True TOTP would need an extra lib; we use a 6-digit OTP yang berubah tiap
// menit, kalkulasi dari secret + minute. Owner bisa lihat di tab 2FA.
const TFA_KEY = "pinz_2fa_secret";
export function get2FASecret(): string {
  let s = localStorage.getItem(TFA_KEY);
  if (!s) { s = Math.random().toString(36).slice(2, 10).toUpperCase(); localStorage.setItem(TFA_KEY, s); }
  return s;
}
export function reset2FASecret(): string {
  localStorage.removeItem(TFA_KEY); return get2FASecret();
}
function hash32(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return h >>> 0;
}
export function getCurrent2FACode(): string {
  const secret = get2FASecret();
  const minute = Math.floor(Date.now() / 30_000); // 30s window
  const h = hash32(secret + ":" + minute);
  return (h % 1_000_000).toString().padStart(6, "0");
}
export function verify2FACode(code: string): boolean {
  const c = code.trim();
  if (!/^\d{6}$/.test(c)) return false;
  // Allow current + previous window for clock-skew.
  const secret = get2FASecret();
  const m = Math.floor(Date.now() / 30_000);
  for (const w of [m, m - 1]) {
    const ex = (hash32(secret + ":" + w) % 1_000_000).toString().padStart(6, "0");
    if (ex === c) return true;
  }
  return false;
}
export function set2FAEnabled(userId: string, enabled: boolean) {
  patchUser(userId, { twoFA: enabled } as any);
}

// ─── Device Fingerprint & Duplicate Detection ─────────────────────────────
const DEV_KEY = "pinz_device_id";
export function getDeviceId(): string {
  let id = localStorage.getItem(DEV_KEY);
  if (id) return id;
  // Bangun fingerprint sederhana dari UA + screen + timezone.
  const raw = [
    navigator.userAgent,
    navigator.language,
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ].join("|");
  id = "DEV-" + hash32(raw).toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  localStorage.setItem(DEV_KEY, id);
  return id;
}
/** Return list of users yang punya device ini (untuk deteksi duplikat). */
export function findUsersByDevice(deviceId: string, exceptUserId?: string): User[] {
  const all = getUsers() as (User & UserExt)[];
  return all.filter((u) => u.devices?.includes(deviceId) && u.id !== exceptUserId);
}
export function attachDeviceToUser(userId: string) {
  const dev = getDeviceId();
  const u = getUserExt(userId);
  if (!u) return;
  const devices = Array.from(new Set([...(u.devices || []), dev]));
  patchUser(userId, { devices } as any);
}

// ─── Bulk Stock Add ────────────────────────────────────────────────────────
import { getStockKeys, setStockKeys } from "./storage";
export function bulkAddStockKeys(productId: string, variantId: string, raw: string): {
  added: number; total: number; sample: string[];
} {
  const keys = raw
    .split(/[\r\n,;]+/)
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
  if (keys.length === 0) return { added: 0, total: getStockKeys(productId, variantId).length, sample: [] };
  const cur = getStockKeys(productId, variantId);
  const merged = [...cur, ...keys];
  setStockKeys(productId, variantId, merged);
  pushActivity("admin", `Bulk add ${keys.length} key ke ${productId}:${variantId}`);
  return { added: keys.length, total: merged.length, sample: keys.slice(0, 3) };
}

// ─── Refund / Cancel with notes ───────────────────────────────────────────
export function refundOrder(orderId: string, reason: string, actor?: string): boolean {
  const all = getOrders();
  const idx = all.findIndex((o) => o.id === orderId);
  if (idx < 0) return false;
  const o = all[idx] as (Order & { refundReason?: string; refundedAt?: string });
  o.status = "cancelled";
  o.refundReason = reason;
  o.refundedAt = new Date().toISOString();
  o.updatedAt = new Date().toISOString();
  all[idx] = o;
  saveOrders(all);
  pushActivity("order", `Order ${orderId} refund: ${reason}`, { actor });
  pushNotif(o.userId, "warning", "Order di-refund", `Order ${o.id} dikembalikan. Alasan: ${reason}`);
  return true;
}

// ─── Backup / Export Database ─────────────────────────────────────────────
const PINZ_KEYS = [
  "pinz_users", "pinz_orders", "pinz_stock", "pinz_product_overrides",
  "pinz_payment_settings", "pinz_announcement", "pinz_broadcast", "pinz_coupons",
  "pinz_purchase_notifs", "pinz_maintenance", "pinz_scheduled_announcements",
  "pinz_activity_log", "pinz_wishlist", "pinz_inapp_notifs", "pinz_2fa_secret",
  "pinz_device_id", "pinz_chat", "pinz_app_version",
];
export interface BackupSnapshot {
  exportedAt: string;
  version: string;
  data: Record<string, any>;
}
export function exportDatabase(): BackupSnapshot {
  const data: Record<string, any> = {};
  for (const k of PINZ_KEYS) {
    const v = localStorage.getItem(k);
    if (v == null) continue;
    try { data[k] = JSON.parse(v); } catch { data[k] = v; }
  }
  return { exportedAt: new Date().toISOString(), version: "v1", data };
}
export function importDatabase(snap: BackupSnapshot): { ok: boolean; restored: number; error?: string } {
  if (!snap || !snap.data) return { ok: false, restored: 0, error: "Format tidak valid." };
  let count = 0;
  for (const [k, v] of Object.entries(snap.data)) {
    if (!PINZ_KEYS.includes(k)) continue;
    localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
    broadcastStorageChange(k);
    count++;
  }
  pushActivity("admin", `Database diimpor (${count} key)`);
  return { ok: true, restored: count };
}
export function downloadBackup() {
  const snap = exportDatabase();
  const blob = new Blob([JSON.stringify(snap, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `viorelvar-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  pushActivity("admin", "Database diunduh");
}

// ─── Live Chat (admin ↔ user, server-of-truth via Netlify Blobs) ──────────
//
// Sumber kebenaran: endpoint serverless `/api/chat` (lihat
// `netlify/functions/chat.mts`) yang menyimpan ChatMap di Netlify Blobs.
// localStorage hanya cache lokal supaya UI bisa render instan & offline.
//
// Alur sinkron:
//  • `sendChat()`         → optimistic insert ke localStorage + POST ke server
//  • `markChatRead()`     → optimistic update + PATCH ke server
//  • `startChatSync(ms)`  → polling GET tiap N ms; merge respons ke localStorage
//                            lalu broadcast event `pinz_chat_new` agar UI re-render
export interface ChatMessage {
  id: string;
  from: "user" | "admin";
  text: string;
  at: string;
  read?: boolean;
}
const CHAT_KEY = "pinz_chat";
const CHAT_API = "/api/chat";

// Fallback backend chat lewat layanan public KV (jsonblob.com).
// Dipakai kalau Netlify Function /api/chat tidak available (404) — ini
// terjadi misalnya saat deploy Netlify gagal/stuck. Browser nge-PUT/GET
// langsung ke jsonblob.com pakai CORS publik, tidak butuh server side.
// Dua device yang akses bin yang sama otomatis lihat chat yang sama.
const JSONBLOB_CHAT_URL =
  "https://jsonblob.com/api/jsonBlob/019dc00e-9d28-7c1e-9085-e5f9861320e9";

// State internal: kalau /api/chat sudah pernah 404, langsung skip ke fallback
// supaya tidak buang waktu round-trip yang pasti gagal.
let _chatApiBroken = false;

async function remoteGetMap(): Promise<ChatMap | null> {
  if (!_chatApiBroken) {
    try {
      const r = await fetch(CHAT_API, { headers: { "cache-control": "no-store" } });
      if (r.ok) return (await r.json()) as ChatMap;
      if (r.status === 404) _chatApiBroken = true;
    } catch {}
  }
  // Fallback: baca dari jsonblob.
  try {
    const r = await fetch(JSONBLOB_CHAT_URL, { cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()) as ChatMap;
  } catch { return null; }
}

async function remotePutMap(map: ChatMap): Promise<void> {
  // Tulis ke jsonblob (PUT replace seluruh isi). /api/chat lewati di mode
  // fallback karena dia tidak menerima PUT bulk — masing2 mutation di-handle
  // di sendChat/markChatRead/resetChatThread melalui POST/PATCH/DELETE.
  try {
    await fetch(JSONBLOB_CHAT_URL, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(map),
    });
  } catch {}
}
type ChatMap = Record<string, ChatMessage[]>;
function getChatMap(): ChatMap {
  try { return JSON.parse(localStorage.getItem(CHAT_KEY) || "{}"); } catch { return {}; }
}
function saveChatMap(m: ChatMap) { localStorage.setItem(CHAT_KEY, JSON.stringify(m)); }

// Gabungkan dua ChatMap. Pesan dari server jadi acuan; pesan lokal yang
// belum sempat ter-POST tetap dipertahankan (dedupe berdasar at|from|text
// sebab id lokal pasti beda dengan id server).
function mergeChatMaps(local: ChatMap, remote: ChatMap): ChatMap {
  const out: ChatMap = { ...remote };
  for (const [uid, localMsgs] of Object.entries(local)) {
    const remoteMsgs = out[uid] || [];
    const seen = new Set(remoteMsgs.map((m) => `${m.at}|${m.from}|${m.text}`));
    const extras = localMsgs.filter((m) => !seen.has(`${m.at}|${m.from}|${m.text}`));
    if (extras.length === 0 && remoteMsgs.length === localMsgs.length) {
      out[uid] = remoteMsgs;
    } else {
      out[uid] = [...remoteMsgs, ...extras]
        .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
        .slice(-200);
    }
  }
  return out;
}

function broadcastChatChange(detail: Record<string, unknown> = {}) {
  try { window.dispatchEvent(new CustomEvent("pinz_chat_new", { detail })); } catch {}
}

export function getChatThread(userId: string): ChatMessage[] {
  return getChatMap()[userId] || [];
}

// Push ChatMap lokal ke remote backend lewat jsonblob (read-modify-write
// untuk merge dengan pesan terbaru dari device lain). Dipakai sebagai
// fallback kalau Netlify Function /api/chat tidak available.
async function pushChatViaJSONBlob() {
  try {
    const r = await fetch(JSONBLOB_CHAT_URL, { cache: "no-store" });
    const remote = (r.ok ? ((await r.json()) as ChatMap) : {}) || {};
    const merged = mergeChatMaps(getChatMap(), remote);
    saveChatMap(merged);
    await remotePutMap(merged);
    broadcastChatChange({ source: "jsonblob-push" });
  } catch {}
}

export function sendChat(userId: string, from: "user" | "admin", text: string) {
  const trimmed = text.trim();
  if (!trimmed) return;
  // 1) Optimistic insert lokal supaya UI langsung tampak.
  const m = getChatMap();
  const cur = m[userId] || [];
  cur.push({ id: rid(), from, text: trimmed, at: new Date().toISOString(), read: false });
  m[userId] = cur.slice(-200);
  saveChatMap(m);
  broadcastChatChange({ userId, from });
  // 2) Kirim ke server. Coba /api/chat dulu; kalau broken (404) → fallback
  //    ke jsonblob (PUT ChatMap utuh).
  if (_chatApiBroken) {
    void pushChatViaJSONBlob();
    return;
  }
  void fetch(CHAT_API, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId, from, text: trimmed }),
  })
    .then(async (r) => {
      if (r.status === 404) { _chatApiBroken = true; void pushChatViaJSONBlob(); return; }
      if (!r.ok) { void pushChatViaJSONBlob(); return; }
      const data = (await r.json()) as { map?: ChatMap };
      if (data.map) {
        const merged = mergeChatMaps(getChatMap(), data.map);
        saveChatMap(merged);
        broadcastChatChange({ source: "post" });
      }
    })
    .catch(() => { void pushChatViaJSONBlob(); });
}

export function getAllChatThreads(): { userId: string; lastMessage?: ChatMessage; unread: number }[] {
  const m = getChatMap();
  return Object.entries(m).map(([userId, msgs]) => ({
    userId,
    lastMessage: msgs[msgs.length - 1],
    unread: msgs.filter((x) => x.from === "user" && !x.read).length,
  })).sort((a, b) => {
    const at = a.lastMessage ? new Date(a.lastMessage.at).getTime() : 0;
    const bt = b.lastMessage ? new Date(b.lastMessage.at).getTime() : 0;
    return bt - at;
  });
}

export function markChatRead(userId: string, side: "user" | "admin") {
  const m = getChatMap();
  m[userId] = (m[userId] || []).map((msg) => msg.from !== side ? { ...msg, read: true } : msg);
  saveChatMap(m);
  if (_chatApiBroken) { void pushChatViaJSONBlob(); return; }
  void fetch(CHAT_API, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId, side }),
  }).then((r) => {
    if (r.status === 404) { _chatApiBroken = true; void pushChatViaJSONBlob(); }
  }).catch(() => { void pushChatViaJSONBlob(); });
}

// Reset/hapus seluruh riwayat chat untuk satu user. Optimistic update lokal
// + DELETE ke server. Server akan menyisipkan satu pesan sistem supaya
// kedua sisi tahu chat sudah direset & thread tetap terlihat di inbox admin.
// Aksi ini juga ter-log di Activity Log admin (tersinkron antar device
// karena pinz_activity_log termasuk MULTI_WRITER_KEYS di cloud-sync).
export function resetChatThread(
  userId: string,
  by: "user" | "admin",
  byName?: string,
) {
  // 1) Optimistic clear lokal (ganti dengan placeholder sistem).
  const m = getChatMap();
  const sysText =
    by === "user"
      ? `[Sistem] Riwayat chat direset oleh pengguna${byName ? ` (@${byName})` : ""}.`
      : `[Sistem] Riwayat chat direset oleh admin${byName ? ` (@${byName})` : ""}.`;
  m[userId] = [
    {
      id: rid(),
      from: "admin",
      text: sysText,
      at: new Date().toISOString(),
      read: by === "admin",
    },
  ];
  saveChatMap(m);
  broadcastChatChange({ userId, action: "reset", by });

  // 2) Catat ke activity log supaya muncul di panel admin (Activity Log)
  //    di semua device admin yang lain.
  try {
    pushActivity(
      "system",
      by === "user"
        ? `Pengguna mereset riwayat chat`
        : `Admin mereset riwayat chat user`,
      { actor: byName, userId, by, channel: "chat" },
    );
  } catch {}

  // 3) Sync ke server. /api/chat dulu, fallback jsonblob (PUT seluruh map).
  if (_chatApiBroken) { void pushChatViaJSONBlob(); return; }
  void fetch(CHAT_API, {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId, by, byName }),
  })
    .then(async (r) => {
      if (r.status === 404) { _chatApiBroken = true; void pushChatViaJSONBlob(); return; }
      if (!r.ok) { void pushChatViaJSONBlob(); return; }
      const data = (await r.json()) as { map?: ChatMap };
      if (data.map) {
        saveChatMap(data.map);
        broadcastChatChange({ source: "delete" });
      }
    })
    .catch(() => { void pushChatViaJSONBlob(); });
}

// Tarik ChatMap terbaru dari server dan merge ke localStorage.
// Pakai remoteGetMap() yang otomatis fallback ke jsonblob kalau /api/chat 404.
let _chatPullInFlight = false;
export async function pullChatsFromServer(): Promise<void> {
  if (_chatPullInFlight) return;
  _chatPullInFlight = true;
  try {
    const remote = await remoteGetMap();
    if (!remote) return;
    const local = getChatMap();
    const merged = mergeChatMaps(local, remote);
    if (JSON.stringify(merged) !== JSON.stringify(local)) {
      saveChatMap(merged);
      broadcastChatChange({ source: "pull" });
    }
  } catch {}
  finally { _chatPullInFlight = false; }
}

// Mulai polling otomatis (default tiap 1.5 detik). Mengembalikan fungsi
// untuk menghentikannya — panggil dari `useEffect` cleanup.
export function startChatSync(intervalMs = 1500): () => void {
  void pullChatsFromServer();
  const t = setInterval(() => { void pullChatsFromServer(); }, intervalMs);
  // Sinkron juga waktu tab kembali aktif supaya tidak menunggu interval.
  const onVisible = () => { if (document.visibilityState === "visible") void pullChatsFromServer(); };
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    clearInterval(t);
    document.removeEventListener("visibilitychange", onVisible);
  };
}

// ─── Impersonation ─────────────────────────────────────────────────────────
const IMPERSONATE_KEY = "pinz_impersonate_origin";
export function startImpersonate(originUser: User) {
  localStorage.setItem(IMPERSONATE_KEY, JSON.stringify(originUser));
  pushActivity("admin", `Impersonate dimulai oleh ${originUser.username}`);
}
export function stopImpersonate(): User | null {
  const raw = localStorage.getItem(IMPERSONATE_KEY);
  if (!raw) return null;
  localStorage.removeItem(IMPERSONATE_KEY);
  try { return JSON.parse(raw); } catch { return null; }
}
export function isImpersonating(): boolean {
  return !!localStorage.getItem(IMPERSONATE_KEY);
}
export function getImpersonateOrigin(): User | null {
  const raw = localStorage.getItem(IMPERSONATE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// ─── helpers ───────────────────────────────────────────────────────────────
function rid(): string {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}
