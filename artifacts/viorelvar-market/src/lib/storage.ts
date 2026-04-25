import { PRODUCTS, type Product, type ProductVariant, type ProductCategory } from "@/data/products";

export type UserRole = "user" | "reseller" | "pro" | "elite" | "admin" | "owner";

export interface User {
  id: string;
  username: string;
  password: string;
  role: UserRole;
  createdAt: string;
  // Profile
  nickname?: string;
  bio?: string;
  avatarBase64?: string;   // base64 image
  email?: string;          // for backup key & notifications
  // Security
  pin?: string;            // hashed-ish 4-6 digit PIN to view keys
}

export interface Order {
  id: string;
  userId: string;
  username: string;
  productId: string;
  productName: string;
  variantId: string;
  variantLabel: string;
  variantPrice: number;
  buyerName: string;
  paymentMethod: "qris" | "usdt";
  status: "pending" | "paid" | "pending_verify" | "verified" | "cancelled";
  key?: string;
  proofFileBase64?: string;
  proofFileName?: string;
  amountUSDT?: number;
  couponCode?: string;
  discountIDR?: number;
  finalPriceIDR?: number;
  // Garansi & layanan key
  warrantyDays?: number;     // default 30
  replacedAt?: string;       // ISO ketika user pakai 1× replace
  oldKeys?: string[];        // history key sebelum di-replace
  warrantyClaimedAt?: string;// klaim garansi (catat saja)
  backupSentAt?: string;     // last time key dikirim ulang via email
  // Masa aktif key (durasi langganan)
  durationMs?: number;       // 0 = lifetime, undefined = tidak ada masa aktif
  activatedAt?: number;      // ms saat key diberikan (mulai hitung mundur)
  expiresAt?: number;        // ms saat key habis (activatedAt + durationMs)
  createdAt: string;
  updatedAt: string;
}

const IDR_TO_USD_RATE = 16200;

// ─── Realtime broadcast (semua perubahan localStorage) ──────────────────
// Dipakai oleh useLiveStorage() di lib/use-live-storage.ts supaya halaman
// pembeli (katalog, harga, settings, riwayat, dll) auto-refresh setiap
// admin menyimpan sesuatu — tanpa perlu reload manual.
export const STORAGE_EVENT = "pinz:storage";
export function broadcastStorageChange(key?: string): void {
  try {
    window.dispatchEvent(new CustomEvent(STORAGE_EVENT, { detail: { key } }));
  } catch {}
}

// ─── Security: Session Token ───────────────────────────────────────────────
export function generateSessionToken(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function getSessionToken(): string | null {
  return localStorage.getItem("pinz_stok") || null;
}

export function setSessionToken(token: string): void {
  localStorage.setItem("pinz_stok", token);
}

export function clearSessionToken(): void {
  localStorage.removeItem("pinz_stok");
}

// ─── Security: Order Rate Limiting ────────────────────────────────────────
const ORDER_COOLDOWN_MS  = 45 * 1000;
const ORDER_HOURLY_MAX   = 8;
const MAX_ACTIVE_PENDING = 3;

export function canCreateOrder(userId: string): { ok: boolean; reason?: string } {
  const orders = getOrders();
  const mine   = orders.filter((o) => o.userId === userId);
  const last = mine.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  if (last) {
    const elapsed = Date.now() - new Date(last.createdAt).getTime();
    if (elapsed < ORDER_COOLDOWN_MS) {
      const wait = Math.ceil((ORDER_COOLDOWN_MS - elapsed) / 1000);
      return { ok: false, reason: `Tunggu ${wait} detik sebelum order lagi.` };
    }
  }
  const oneHourAgo  = new Date(Date.now() - 60 * 60 * 1000);
  const recentCount = mine.filter((o) => new Date(o.createdAt) > oneHourAgo).length;
  if (recentCount >= ORDER_HOURLY_MAX) {
    return { ok: false, reason: "Terlalu banyak order dalam 1 jam. Coba lagi nanti." };
  }
  const activeCount = mine.filter((o) => o.status === "pending" || o.status === "pending_verify").length;
  if (activeCount >= MAX_ACTIVE_PENDING) {
    return { ok: false, reason: `Kamu punya ${activeCount} order aktif. Selesaikan dulu sebelum order baru.` };
  }
  return { ok: true };
}

export const toUSD = (idr: number) => (idr / IDR_TO_USD_RATE).toFixed(2);

function generateId(): string {
  return Math.random().toString(36).slice(2, 9).toUpperCase() + Date.now().toString(36).toUpperCase();
}

/**
 * Generate a proper invoice-style order ID, e.g.  INV-20260424-7K3F9A
 * Used for all real orders and seed data — no more "dummy-..." prefixes.
 */
export function generateOrderId(d: Date = new Date()): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `INV-${yyyy}${mm}${dd}-${rand}`;
}

// ─── Users ─────────────────────────────────────────────────────────────────
export function getUsers(): User[] {
  const raw = localStorage.getItem("pinz_users");
  if (!raw) {
    const defaults: User[] = [
      { id: "owner", username: "Rafa", password: "Rama123", role: "owner", createdAt: new Date().toISOString() },
    ];
    localStorage.setItem("pinz_users", JSON.stringify(defaults));
    return defaults;
  }
  let users: User[];
  try { users = JSON.parse(raw); } catch { users = []; }
  if (!Array.isArray(users)) users = [];
  let changed = false;
  // Migrate any old owner/admin defaults to the new Rafa / Rama123 owner.
  const ownerUser = users.find((u) => u.role === "owner");
  if (!ownerUser) {
    users.unshift({ id: "owner", username: "Rafa", password: "Rama123", role: "owner", createdAt: new Date().toISOString() });
    changed = true;
  } else if (
    ownerUser.username === "owner" ||
    ownerUser.password === "owner123" ||
    ownerUser.username === "vior"
  ) {
    ownerUser.username = "Rafa";
    ownerUser.password = "Rama123";
    changed = true;
  }
  // Remove the legacy admin account ("vior"/"admin"); Rafa is the only built-in.
  const before = users.length;
  users = users.filter((u) => !(u.role === "admin" && (u.username === "vior" || u.username === "admin")));
  if (users.length !== before) changed = true;
  if (changed) localStorage.setItem("pinz_users", JSON.stringify(users));
  return users;
}

export function saveUsers(users: User[]) {
  localStorage.setItem("pinz_users", JSON.stringify(users));
  broadcastStorageChange("pinz_users");
}

export function findUser(username: string): User | undefined {
  return getUsers().find((u) => u.username.toLowerCase() === username.toLowerCase());
}

export function registerUser(username: string, password: string): { ok: boolean; error?: string } {
  const users = getUsers();
  if (users.find((u) => u.username.toLowerCase() === username.toLowerCase())) {
    return { ok: false, error: "Username sudah digunakan" };
  }
  const user: User = { id: generateId(), username, password, role: "user", createdAt: new Date().toISOString() };
  users.push(user);
  saveUsers(users);
  return { ok: true };
}

export function loginUser(username: string, password: string): User | null {
  const user = findUser(username);
  if (!user || user.password !== password) return null;
  return user;
}

export function getSession(): User | null {
  const raw = localStorage.getItem("pinz_session");
  if (!raw) return null;
  try {
    const saved: User = JSON.parse(raw);
    const users = getUsers();
    const valid = users.find((u) => u.id === saved.id);
    if (!valid) { localStorage.removeItem("pinz_session"); return null; }
    return valid;
  } catch {
    localStorage.removeItem("pinz_session");
    return null;
  }
}

export function setSession(user: User) { localStorage.setItem("pinz_session", JSON.stringify(user)); }
export function clearSession() { localStorage.removeItem("pinz_session"); }

// ─── Orders ────────────────────────────────────────────────────────────────
export function getOrders(): Order[] {
  const raw = localStorage.getItem("pinz_orders");
  let list: Order[] = [];
  if (raw) {
    try { const p = JSON.parse(raw); if (Array.isArray(p)) list = p; } catch {}
  }
  // Migrasi: untuk order lama yang sudah punya key tapi belum punya expiresAt,
  // hitung otomatis dari label varian + tanggal updatedAt (mulai aktif).
  let dirty = false;
  for (const o of list) {
    const eligible = (o.status === "paid" || o.status === "verified") && !!o.key;
    if (eligible && o.durationMs === undefined && o.expiresAt === undefined) {
      const dur = parseDurationMs(o.variantLabel);
      if (dur !== undefined) {
        const start = new Date(o.updatedAt || o.createdAt).getTime();
        o.durationMs = dur;
        o.activatedAt = start;
        if (dur > 0) o.expiresAt = start + dur;
        dirty = true;
      }
    }
  }
  if (dirty) localStorage.setItem("pinz_orders", JSON.stringify(list));
  return list;
}
export function saveOrders(orders: Order[]) {
  localStorage.setItem("pinz_orders", JSON.stringify(orders));
  broadcastStorageChange("pinz_orders");
}
export function getOrderById(id: string): Order | undefined { return getOrders().find((o) => o.id === id); }
export function getUserOrders(userId: string): Order[] { return getOrders().filter((o) => o.userId === userId); }

export function createOrder(data: Omit<Order, "id" | "createdAt" | "updatedAt">): Order {
  const order: Order = { ...data, id: generateOrderId(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const orders = getOrders();
  orders.push(order);
  saveOrders(orders);
  return order;
}

export function updateOrder(id: string, updates: Partial<Order>) {
  const orders = getOrders();
  const idx = orders.findIndex((o) => o.id === id);
  if (idx !== -1) {
    orders[idx] = { ...orders[idx], ...updates, updatedAt: new Date().toISOString() };
    saveOrders(orders);
    return orders[idx];
  }
  return null;
}

// ─── Stock Keys (per product+variant) ──────────────────────────────────────
// Map key: `${productId}:${variantId}` → array of available keys (queue)
export type StockMap = Record<string, string[]>;

function defaultStockSeed(): StockMap {
  const seed: StockMap = {};
  PRODUCTS.forEach((p) => {
    p.variants.forEach((v) => {
      const tag = p.id.toUpperCase().slice(0, 4);
      const vtag = v.id.toUpperCase().slice(0, 4);
      seed[`${p.id}:${v.id}`] = [
        `VRL-${tag}-${vtag}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        `VRL-${tag}-${vtag}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        `VRL-${tag}-${vtag}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      ];
    });
  });
  return seed;
}

export function getStockMap(): StockMap {
  const raw = localStorage.getItem("pinz_stock");
  if (!raw) {
    const seed = defaultStockSeed();
    localStorage.setItem("pinz_stock", JSON.stringify(seed));
    return seed;
  }
  try { return JSON.parse(raw); } catch { return {}; }
}

export function saveStockMap(map: StockMap) {
  const ok = safeSetItem("pinz_stock", JSON.stringify(map));
  if (!ok) throw new Error("QUOTA_EXCEEDED: pinz_stock");
  broadcastStorageChange("pinz_stock");
}

export function getStockKeys(productId: string, variantId: string): string[] {
  return getStockMap()[`${productId}:${variantId}`] || [];
}

export function setStockKeys(productId: string, variantId: string, keys: string[]) {
  const map = getStockMap();
  map[`${productId}:${variantId}`] = keys;
  saveStockMap(map);
}

export function popStockKey(productId: string, variantId: string): string {
  const map = getStockMap();
  const k = `${productId}:${variantId}`;
  const arr = map[k] || [];
  if (arr.length === 0) {
    return `VRL-AUTO-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  }
  const key = arr.shift()!;
  map[k] = arr;
  saveStockMap(map);
  return key;
}

// ─── Product Overrides (admin-edited title/image/variant prices) ───────────
export interface ProductOverride {
  title?: string;
  imageUrl?: string;
  publisher?: string;
  category?: Product["category"];
  variantPrices?: Record<string, number>;
  variantLabels?: Record<string, string>;
  /** Admin-added extra variants on top of the base product. */
  extraVariants?: ProductVariant[];
  /** IDs of base variants that the admin has removed. */
  removedVariantIds?: string[];
  /** Soft-delete flag for a base product. */
  removed?: boolean;
  /** Admin-overridden total sold count shown on the product card. */
  soldCount?: number;
}
export type ProductOverrideMap = Record<string, ProductOverride>;

export function getProductOverrides(): ProductOverrideMap {
  const raw = localStorage.getItem("pinz_product_overrides");
  if (!raw) return {};
  try {
    const p = JSON.parse(raw);
    return p && typeof p === "object" ? p : {};
  } catch { return {}; }
}
export function saveProductOverrides(map: ProductOverrideMap) {
  const ok = safeSetItem("pinz_product_overrides", JSON.stringify(map));
  if (!ok) throw new Error("QUOTA_EXCEEDED: pinz_product_overrides");
  broadcastStorageChange("pinz_product_overrides");
}
export function setProductOverride(productId: string, override: ProductOverride) {
  const map = getProductOverrides();
  map[productId] = { ...map[productId], ...override };
  saveProductOverrides(map);
}

/** Mark a base product as removed (soft-delete). Custom products are removed from extraProducts directly. */
export function deleteProduct(productId: string) {
  if (PRODUCTS.find((p) => p.id === productId)) {
    setProductOverride(productId, { removed: true });
  } else {
    saveExtraProducts(getExtraProducts().filter((p) => p.id !== productId));
  }
}

export function restoreProduct(productId: string) {
  const map = getProductOverrides();
  if (map[productId]) {
    delete map[productId].removed;
    saveProductOverrides(map);
  }
}

// ─── Extra Products (admin-created custom products) ───────────────────────
export function getExtraProducts(): Product[] {
  try { return JSON.parse(localStorage.getItem("pinz_extra_products") || "[]"); }
  catch { return []; }
}
export function saveExtraProducts(list: Product[]) {
  const ok = safeSetItem("pinz_extra_products", JSON.stringify(list));
  if (!ok) throw new Error("QUOTA_EXCEEDED: pinz_extra_products");
  broadcastStorageChange("pinz_extra_products");
}
export function addExtraProduct(p: Omit<Product, "soldCount"> & { soldCount?: number }): Product {
  const newP: Product = {
    soldCount: 0,
    ...p,
  } as Product;
  const list = getExtraProducts();
  list.push(newP);
  saveExtraProducts(list);
  return newP;
}

/** Generate a kebab-case id for a custom product/variant. */
export function makeSlug(input: string, fallbackPrefix = "item"): string {
  const base = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 32);
  const suffix = Math.random().toString(36).slice(2, 6);
  return base ? `${base}-${suffix}` : `${fallbackPrefix}-${suffix}`;
}

export function applyOverride<T extends Product>(p: T): T {
  const ov = getProductOverrides()[p.id];
  if (!ov) return p;
  const removedSet = new Set(ov.removedVariantIds || []);
  const baseVariants = p.variants.filter((v) => !removedSet.has(v.id));
  const extra = ov.extraVariants || [];
  const variants = [...baseVariants, ...extra].map((v) => ({
    ...v,
    price: ov.variantPrices?.[v.id] ?? v.price,
    label: ov.variantLabels?.[v.id] || v.label,
  }));
  return {
    ...p,
    title: ov.title || p.title,
    imageUrl: ov.imageUrl || p.imageUrl,
    publisher: ov.publisher || p.publisher,
    category: ov.category || p.category,
    price: variants[0]?.price ?? p.price,
    variants,
    soldCount: typeof ov.soldCount === "number" ? ov.soldCount : p.soldCount,
  };
}

/**
 * Returns the merged catalog: base PRODUCTS (excluding soft-deleted) plus
 * admin-added extra products, all with overrides applied.
 */
export function getAllProducts(): Product[] {
  const overrides = getProductOverrides();
  const base = PRODUCTS
    .filter((p) => !overrides[p.id]?.removed)
    .map((p) => applyOverride(p));
  const extra = getExtraProducts().map((p) => applyOverride(p));
  return [...base, ...extra];
}

/** Lookup a product by id from the merged catalog. */
export function getProductByIdMerged(id: string): Product | undefined {
  return getAllProducts().find((p) => p.id === id);
}

export type { ProductCategory };

// ─── Categories (admin-managed) ───────────────────────────────────────────
import { DEFAULT_CATEGORIES } from "@/data/products";
export interface CategoryDef { id: string; label: string }

export function getCategories(): CategoryDef[] {
  const raw = localStorage.getItem("pinz_categories");
  if (raw) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.every((c) => c && typeof c.id === "string" && typeof c.label === "string")) {
        return arr;
      }
    } catch {}
  }
  // Seed: defaults + any categories used by existing products
  const seed: CategoryDef[] = [...DEFAULT_CATEGORIES];
  const existingIds = new Set(seed.map((c) => c.id));
  PRODUCTS.forEach((p) => {
    if (!existingIds.has(p.category)) {
      seed.push({ id: p.category, label: p.category });
      existingIds.add(p.category);
    }
  });
  return seed;
}

export function saveCategories(list: CategoryDef[]) {
  const ok = safeSetItem("pinz_categories", JSON.stringify(list));
  if (!ok) throw new Error("QUOTA_EXCEEDED: pinz_categories");
  broadcastStorageChange("pinz_categories");
}

export function addCategory(label: string): CategoryDef | null {
  const trimmed = label.trim();
  if (!trimmed) return null;
  const list = getCategories();
  const id = makeSlug(trimmed, "kategori");
  const cat: CategoryDef = { id, label: trimmed };
  list.push(cat);
  saveCategories(list);
  return cat;
}

export function renameCategory(id: string, newLabel: string): boolean {
  const trimmed = newLabel.trim();
  if (!trimmed) return false;
  const list = getCategories();
  const idx = list.findIndex((c) => c.id === id);
  if (idx < 0) return false;
  list[idx] = { ...list[idx], label: trimmed };
  saveCategories(list);
  return true;
}

export function deleteCategory(id: string) {
  saveCategories(getCategories().filter((c) => c.id !== id));
}

export function getCategoryLabel(id: string): string {
  const c = getCategories().find((x) => x.id === id);
  return c ? c.label : id;
}

/** Ensure a category id exists; creates it (with id == label) if missing. */
export function ensureCategory(idOrLabel: string): string {
  const trimmed = idOrLabel.trim();
  if (!trimmed) return "";
  const list = getCategories();
  if (list.some((c) => c.id === trimmed)) return trimmed;
  list.push({ id: trimmed, label: trimmed });
  saveCategories(list);
  return trimmed;
}

// ─── Publishers (admin-managed) ───────────────────────────────────────────
export function getPublishers(): string[] {
  const raw = localStorage.getItem("pinz_publishers");
  if (raw) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.every((s) => typeof s === "string")) return arr;
    } catch {}
  }
  // Seed: derive unique publishers from base products
  const set = new Set<string>();
  PRODUCTS.forEach((p) => p.publisher && set.add(p.publisher));
  return Array.from(set);
}

export function savePublishers(list: string[]) {
  const ok = safeSetItem("pinz_publishers", JSON.stringify(list));
  if (!ok) throw new Error("QUOTA_EXCEEDED: pinz_publishers");
  broadcastStorageChange("pinz_publishers");
}

export function addPublisher(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  const list = getPublishers();
  if (list.includes(trimmed)) return false;
  list.push(trimmed);
  savePublishers(list);
  return true;
}

export function renamePublisher(oldName: string, newName: string): boolean {
  const trimmed = newName.trim();
  if (!trimmed) return false;
  const list = getPublishers().map((p) => (p === oldName ? trimmed : p));
  savePublishers(list);
  // Cascade rename across product overrides + extra products.
  const overrides = getProductOverrides();
  let dirty = false;
  Object.keys(overrides).forEach((pid) => {
    if (overrides[pid].publisher === oldName) {
      overrides[pid].publisher = trimmed;
      dirty = true;
    }
  });
  if (dirty) saveProductOverrides(overrides);
  const extras = getExtraProducts();
  let extrasDirty = false;
  extras.forEach((p) => {
    if (p.publisher === oldName) { p.publisher = trimmed; extrasDirty = true; }
  });
  if (extrasDirty) saveExtraProducts(extras);
  return true;
}

export function deletePublisher(name: string) {
  savePublishers(getPublishers().filter((p) => p !== name));
}

/** Ensure a publisher exists in the managed list (no rename, just add). */
export function ensurePublisher(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  const list = getPublishers();
  if (!list.includes(trimmed)) {
    list.push(trimmed);
    savePublishers(list);
  }
  return trimmed;
}

// ─── Parser durasi key dari label varian ──────────────────────────────────
// Mendukung: "1 Hari", "7 Days", "2 Minggu/Weeks", "1 Bulan/Month",
// "12 Bulan/Months", "1 Tahun/Year", "Lifetime/Selamanya/Seumur Hidup".
// Return ms; 0 = lifetime; undefined = bukan produk berdurasi.
const D = 86_400_000;
export function parseDurationMs(label: string): number | undefined {
  if (!label) return undefined;
  const s = label.toLowerCase().trim();
  if (/(life ?time|selamanya|seumur ?hidup|permanent|forever)/.test(s)) return 0;
  const m = s.match(/(\d+(?:\.\d+)?)\s*(jam|hour|hours|hr|hari|day|days|minggu|week|weeks|wk|bulan|month|months|mo|tahun|year|years|yr)/);
  if (!m) return undefined;
  const n = parseFloat(m[1]);
  const unit = m[2];
  if (/^(jam|hour|hours|hr)$/.test(unit)) return Math.round(n * 3_600_000);
  if (/^(hari|day|days)$/.test(unit)) return Math.round(n * D);
  if (/^(minggu|week|weeks|wk)$/.test(unit)) return Math.round(n * 7 * D);
  if (/^(bulan|month|months|mo)$/.test(unit)) return Math.round(n * 30 * D);
  if (/^(tahun|year|years|yr)$/.test(unit)) return Math.round(n * 365 * D);
  return undefined;
}

function activatePatch(order: Order): Partial<Order> {
  const dur = parseDurationMs(order.variantLabel);
  if (dur === undefined) return {};                      // bukan langganan
  const now = Date.now();
  return {
    durationMs: dur,
    activatedAt: now,
    expiresAt: dur === 0 ? undefined : now + dur,        // lifetime → tidak ada expiry
  };
}

// ─── Payment Confirmation (auto-deliver key from stock) ───────────────────
export function confirmQrisPayment(orderId: string): Order | null {
  const order = getOrderById(orderId);
  if (!order) return null;
  const key = popStockKey(order.productId, order.variantId);
  pushPurchaseNotif(order, key);
  return updateOrder(orderId, { status: "paid", key, ...activatePatch(order) });
}

export function submitUsdtProof(orderId: string, fileBase64: string, fileName: string): Order | null {
  return updateOrder(orderId, { status: "pending_verify", proofFileBase64: fileBase64, proofFileName: fileName });
}

// Alias supaya halaman QRIS lebih jelas — flow sama persis (status pending_verify + bukti).
export const submitQrisProof = submitUsdtProof;

export function adminVerifyOrder(orderId: string): Order | null {
  const order = getOrderById(orderId);
  if (!order) return null;
  const key = popStockKey(order.productId, order.variantId);
  pushPurchaseNotif(order, key);
  return updateOrder(orderId, { status: "verified", key, ...activatePatch(order) });
}

export function adminRejectOrder(orderId: string): Order | null {
  return updateOrder(orderId, { status: "cancelled" });
}

export function deleteOrder(orderId: string): void {
  const orders = getOrders().filter((o) => o.id !== orderId);
  saveOrders(orders); // saveOrders sudah broadcast otomatis
}

export function deleteUser(userId: string): void {
  const users = getUsers().filter((u) => !(u.id === userId && u.role === "user"));
  saveUsers(users);
}

export function adminCancelPending(): number {
  const orders = getOrders();
  let count = 0;
  const updated = orders.map((o) => {
    if (o.status === "pending") { count++; return { ...o, status: "cancelled" as Order["status"], updatedAt: new Date().toISOString() }; }
    return o;
  });
  saveOrders(updated);
  return count;
}

// ─── Announcement & Broadcast ──────────────────────────────────────────────
export function getAnnouncement(): string { return localStorage.getItem("pinz_announcement") || ""; }
export function setAnnouncement(msg: string): void {
  if (msg.trim()) localStorage.setItem("pinz_announcement", msg.trim());
  else localStorage.removeItem("pinz_announcement");
  broadcastStorageChange("pinz_announcement");
}

export interface Broadcast {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "success" | "danger";
  createdAt: string;
}

export function getBroadcast(): Broadcast | null {
  const raw = localStorage.getItem("pinz_broadcast");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
export function setBroadcast(bc: Omit<Broadcast, "id" | "createdAt">): Broadcast {
  const broadcast: Broadcast = { ...bc, id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), createdAt: new Date().toISOString() };
  localStorage.setItem("pinz_broadcast", JSON.stringify(broadcast));
  broadcastStorageChange("pinz_broadcast");
  return broadcast;
}
export function clearBroadcast(): void { localStorage.removeItem("pinz_broadcast"); broadcastStorageChange("pinz_broadcast"); }
export function hasBroadcastBeenSeen(broadcastId: string): boolean { return localStorage.getItem("pinz_broadcast_seen") === broadcastId; }
export function markBroadcastSeen(broadcastId: string): void { localStorage.setItem("pinz_broadcast_seen", broadcastId); }

// ─── Payment Settings ──────────────────────────────────────────────────────
// Mode QRIS sepenuhnya MANUAL: admin upload satu gambar QRIS statis,
// pembeli scan, lalu klik "Saya Sudah Membayar" untuk konfirmasi.
// Tidak ada integrasi gateway pihak ketiga (Rama API dll).
export interface PaymentSettings {
  qrisImageBase64: string;
  qrisMerchantName?: string; // deprecated, kept for backward-compat
  binancePayId: string;
  binanceQrBase64: string;
}

// Defaults are intentionally blank — admin must configure their own real
// payment details (Binance Pay ID + QR images) via the admin panel.
// Hardcoding a placeholder ID would risk pushing demo data into the live
// store and cause buyers to send funds to the wrong account.
const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  qrisImageBase64: "",
  binancePayId: "",
  binanceQrBase64: "",
};

// QR images are large base64 blobs that can blow past the localStorage quota
// when combined with the rest of the catalog. Store them under their own keys
// so the slim settings object stays well under the 5MB browser limit.
const QRIS_IMAGE_KEY   = "pinz_payment_qris_image";
const BINANCE_IMAGE_KEY = "pinz_payment_binance_image";

export function getPaymentSettings(): PaymentSettings {
  const raw = localStorage.getItem("pinz_payment_settings");
  let base: PaymentSettings = DEFAULT_PAYMENT_SETTINGS;
  if (raw) {
    try { base = { ...DEFAULT_PAYMENT_SETTINGS, ...JSON.parse(raw) }; } catch {}
  }
  // Hydrate QR images from their dedicated keys (fallback to inline value for
  // older saved configs that still carried the base64 in the main blob).
  const qrisImg    = localStorage.getItem(QRIS_IMAGE_KEY)    || base.qrisImageBase64    || "";
  const binanceImg = localStorage.getItem(BINANCE_IMAGE_KEY) || base.binanceQrBase64    || "";
  return { ...base, qrisImageBase64: qrisImg, binanceQrBase64: binanceImg };
}

function safeSetItem(key: string, value: string): boolean {
  try { localStorage.setItem(key, value); return true; }
  catch (err: any) {
    // QuotaExceeded — try to free room by dropping low-priority caches first.
    const dropTiers: string[][] = [
      ["pinz_dummy_seeded_v1", "pinz_dummy_seeded_v2"],
      ["pinz_purchase_notifs", "pinz_chat_messages", "pinz_chat_unread"],
      ["pinz_dummy_orders", "pinz_dummy_users"],
    ];
    for (const tier of dropTiers) {
      try {
        tier.forEach((k) => localStorage.removeItem(k));
        localStorage.setItem(key, value);
        return true;
      } catch { /* try next tier */ }
    }
    console.error(`[storage] Gagal menyimpan ${key}: kuota penyimpanan browser penuh.`, err);
    return false;
  }
}

export function setPaymentSettings(s: Partial<PaymentSettings>): PaymentSettings {
  const current = getPaymentSettings();
  const merged: PaymentSettings = { ...current, ...s };

  // Persist big base64 image fields under their own keys so they don't
  // bloat the main settings blob (and don't trip the localStorage quota).
  if (s.qrisImageBase64 !== undefined) {
    if (merged.qrisImageBase64) safeSetItem(QRIS_IMAGE_KEY, merged.qrisImageBase64);
    else localStorage.removeItem(QRIS_IMAGE_KEY);
  }
  if (s.binanceQrBase64 !== undefined) {
    if (merged.binanceQrBase64) safeSetItem(BINANCE_IMAGE_KEY, merged.binanceQrBase64);
    else localStorage.removeItem(BINANCE_IMAGE_KEY);
  }

  // Save the slim settings (without inline base64) to the main key.
  const slim = { ...merged, qrisImageBase64: "", binanceQrBase64: "" };
  safeSetItem("pinz_payment_settings", JSON.stringify(slim));
  broadcastStorageChange("pinz_payment_settings");
  return merged;
}

// ─── Dummy Counter Offsets ─────────────────────────────────────────────────
export const DUMMY = {
  TOTAL: 22300,        // Total order
  VERIFIED: 22290,     // Terverifikasi
  PENDING: 120,        // Belum bayar
  RECENT: 3000,        // Transaksi terbaru
  BUYERS: 15420,       // Total pembeli (public stat)
  TODAY: 1247,         // Transaksi hari ini
};

// ─── Realtime Purchase Notifications ───────────────────────────────────────
export interface PurchaseNotif {
  id: string;
  username: string;
  productName: string;
  variantLabel: string;
  key: string;
  createdAt: string;
  /** True for synthetic/demo notifications. UI hides key + variant for these. */
  synthetic?: boolean;
}

const NAME_POOL = [
  "rizky", "putra", "dimas", "ahmad", "andi", "fajar", "rahmat", "yusuf",
  "ilham", "satria", "bayu", "reza", "ridho", "bagus", "hendra", "wisnu",
  "citra", "diah", "intan", "salsa", "rina", "ayu", "dewi", "siska",
  "agusxd", "kingsejo", "noobmaster", "gamerz", "proplayer99", "raka_yt",
  "sultanmuda", "raffi.id", "riko_007", "naufalpro", "edolaras", "viki99",
  "biyu_jr", "agus.cuy", "abil_007", "dafa.123", "fauzi.id", "rizki.gg",
];
const SUFFIX_POOL = ["_id", "_yt", "_xx", "07", "99", "23", ".id", ".gg", "vp", "_bro"];

function randomBuyerName(): string {
  const base = NAME_POOL[Math.floor(Math.random() * NAME_POOL.length)];
  if (Math.random() > 0.4) return base + SUFFIX_POOL[Math.floor(Math.random() * SUFFIX_POOL.length)];
  return base;
}

export function generateRandomBuyerName() { return randomBuyerName(); }

export function getPurchaseNotifs(): PurchaseNotif[] {
  const raw = localStorage.getItem("pinz_purchase_notifs");
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p : [];
  } catch { return []; }
}
export function clearPurchaseNotifs() { localStorage.removeItem("pinz_purchase_notifs"); }

function pushPurchaseNotif(order: Order, key: string) {
  const notifs = getPurchaseNotifs();
  notifs.unshift({
    id: generateId(),
    username: order.username,
    productName: order.productName,
    variantLabel: order.variantLabel,
    key,
    createdAt: new Date().toISOString(),
  });
  localStorage.setItem("pinz_purchase_notifs", JSON.stringify(notifs.slice(0, 30)));
  broadcastStorageChange("pinz_purchase_notifs");
  try { window.dispatchEvent(new CustomEvent("pinz_new_purchase", { detail: notifs[0] })); } catch {}
}

// ─── Dummy "Community" Users + Orders (in-memory, never persisted) ─────────
// 1000+ unique usernames + a steady stream of dummy orders that show up in
// the admin Users + Orders tabs. Generated once on first read for speed.
const NAME_PARTS_A = [
  "rio", "rey", "fani", "agus", "andi", "rama", "rafa", "fajar", "dimas", "putra",
  "yudi", "yoga", "ilham", "satria", "raka", "bagas", "tegar", "wisnu", "ridho",
  "naufal", "fauzan", "haikal", "azka", "evan", "danu", "rendi", "raffi", "fikri",
  "alif", "zaki", "irfan", "salman", "kemal", "lutfi", "tegar", "anggi", "noval",
  "fariz", "haris", "bima", "satya", "kevin", "darryl", "matthew", "joshua",
  "nadhif", "tigor", "rifqi", "haidar", "akbar", "agung", "bayu", "panji",
  "diandra", "cecil", "azril", "abil", "edo", "tata", "fadhil", "ridwan",
];
const NAME_PARTS_B = [
  "id", "yt", "gg", "xx", "07", "99", "23", "ml", "vp", "ff", "pubg", "gen",
  "pro", "noob", "king", "lord", "boss", "cool", "kun", "sama", "jr", "sr",
  "cuy", "bro", "bos", "gamer", "play", "alpha", "ace", "rex",
];

function seededRand(seed: number) {
  // Mulberry32 — small fast deterministic PRNG.
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let _dummyUsers: User[] | null = null;
export function getDummyCommunityUsers(): User[] {
  if (_dummyUsers) return _dummyUsers;
  const rand = seededRand(20260422);
  const used = new Set<string>();
  const out: User[] = [];
  let i = 0;
  while (out.length < 1234 && i < 50000) {
    i++;
    const a = NAME_PARTS_A[Math.floor(rand() * NAME_PARTS_A.length)];
    const b = NAME_PARTS_B[Math.floor(rand() * NAME_PARTS_B.length)];
    const sep = rand() < 0.4 ? "_" : rand() < 0.7 ? "." : "";
    const num = rand() < 0.6 ? Math.floor(rand() * 999) : "";
    const name = `${a}${sep}${b}${num}`;
    if (used.has(name)) continue;
    used.add(name);
    const daysAgo = Math.floor(rand() * 365);
    out.push({
      id: `dummy-${out.length}`,
      username: name,
      password: "",
      role: "user",
      createdAt: new Date(Date.now() - daysAgo * 86400000).toISOString(),
    });
  }
  _dummyUsers = out;
  return out;
}

let _dummyOrders: Order[] | null = null;
export function getDummyCommunityOrders(): Order[] {
  if (_dummyOrders) return _dummyOrders;
  const users = getDummyCommunityUsers();
  // Use the merged catalog so admin-created custom products are represented.
  const products = getAllProducts().filter((p) => p.variants && p.variants.length > 0);
  if (products.length === 0) return (_dummyOrders = []);
  const rand = seededRand(424242);
  const out: Order[] = [];
  for (let i = 0; i < 220; i++) {
    const u = users[Math.floor(rand() * users.length)];
    const p = products[Math.floor(rand() * products.length)];
    const v = p.variants[Math.floor(rand() * p.variants.length)];
    const minutesAgo = Math.floor(rand() * 60 * 24 * 7);
    out.push({
      id: `DMY${(100000 + i).toString(36).toUpperCase()}`,
      userId: u.id,
      username: u.username,
      buyerName: u.username,
      productId: p.id,
      productName: p.title,
      variantId: v.id,
      variantLabel: v.label,
      variantPrice: v.price,
      paymentMethod: rand() < 0.7 ? "qris" : "usdt",
      status: "verified",
      createdAt: new Date(Date.now() - minutesAgo * 60000).toISOString(),
      updatedAt: new Date(Date.now() - minutesAgo * 60000).toISOString(),
    } as Order);
  }
  return (_dummyOrders = out.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ));
}

/** Add one fresh dummy order at the head of the in-memory list. */
export function pushDummyOrder(): Order {
  const users = getDummyCommunityUsers();
  // Pull the LIVE catalog so any product the admin creates/renames in the UI
  // immediately starts showing up in the simulated activity stream.
  const products = getAllProducts().filter((p) => p.variants && p.variants.length > 0);
  if (products.length === 0) {
    return {
      id: `DMY${Date.now().toString(36).toUpperCase()}`,
      userId: "dummy", username: "dummy", buyerName: "dummy",
      productId: "", productName: "—", variantId: "", variantLabel: "",
      variantPrice: 0, paymentMethod: "qris", status: "verified",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    } as Order;
  }
  const u = users[Math.floor(Math.random() * users.length)];
  const p = products[Math.floor(Math.random() * products.length)];
  const v = p.variants[Math.floor(Math.random() * p.variants.length)];
  const o: Order = {
    id: `DMY${Date.now().toString(36).toUpperCase()}`,
    userId: u.id,
    username: u.username,
    buyerName: u.username,
    productId: p.id,
    productName: p.title,
    variantId: v.id,
    variantLabel: v.label,
    variantPrice: v.price,
    paymentMethod: Math.random() < 0.7 ? "qris" : "usdt",
    status: "verified",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as Order;
  _dummyOrders = [o, ...(_dummyOrders || getDummyCommunityOrders())].slice(0, 500);
  return o;
}

// Synthetic notification using a random buyer username (for live-feed display).
// Pulls the live catalog (admin overrides + custom products) so brand-new
// products the owner adds start appearing in "PEMBELIAN BARU" right away.
export function makeSyntheticNotif(): PurchaseNotif {
  const products = getAllProducts().filter((p) => p.variants && p.variants.length > 0);
  if (products.length === 0) {
    return {
      id: generateId(),
      username: randomBuyerName(),
      productName: "—",
      variantLabel: "",
      key: "",
      createdAt: new Date().toISOString(),
      synthetic: true,
    };
  }
  const p = products[Math.floor(Math.random() * products.length)];
  const v = p.variants[Math.floor(Math.random() * p.variants.length)];
  const tag = p.id.toUpperCase().slice(0, 4);
  return {
    id: generateId(),
    username: randomBuyerName(),
    productName: p.title,
    variantLabel: v.label,
    key: `VRL-${tag}-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    createdAt: new Date().toISOString(),
    synthetic: true,
  };
}

// ─── Kupon Diskon ──────────────────────────────────────────────────────────
export interface Coupon {
  code: string;                 // unik, uppercase
  type: "percent" | "fixed";    // percent = % off ; fixed = potongan IDR
  value: number;                // 1..100 untuk percent, IDR untuk fixed
  maxRedemptions: number;       // 0 = unlimited
  perUserLimit: number;         // 0 = unlimited per user
  expiresAt?: string;           // ISO date; undefined = no expiry
  active: boolean;
  createdAt: string;
  totalRedemptions: number;
  redemptions: Record<string, number>; // userId -> count
}

const COUPONS_KEY = "pinz_coupons";

export function getCoupons(): Coupon[] {
  try {
    const raw = localStorage.getItem(COUPONS_KEY);
    return raw ? (JSON.parse(raw) as Coupon[]) : [];
  } catch {
    return [];
  }
}

export function saveCoupons(list: Coupon[]) {
  localStorage.setItem(COUPONS_KEY, JSON.stringify(list));
  broadcastStorageChange(COUPONS_KEY);
}

export function upsertCoupon(c: Omit<Coupon, "createdAt" | "totalRedemptions" | "redemptions"> & Partial<Pick<Coupon, "createdAt" | "totalRedemptions" | "redemptions">>): Coupon {
  const all = getCoupons();
  const code = c.code.trim().toUpperCase();
  const idx = all.findIndex((x) => x.code === code);
  const next: Coupon = {
    code,
    type: c.type,
    value: c.value,
    maxRedemptions: c.maxRedemptions || 0,
    perUserLimit: c.perUserLimit || 0,
    expiresAt: c.expiresAt,
    active: c.active,
    createdAt: c.createdAt || (idx >= 0 ? all[idx].createdAt : new Date().toISOString()),
    totalRedemptions: c.totalRedemptions ?? (idx >= 0 ? all[idx].totalRedemptions : 0),
    redemptions: c.redemptions ?? (idx >= 0 ? all[idx].redemptions : {}),
  };
  if (idx >= 0) all[idx] = next;
  else all.push(next);
  saveCoupons(all);
  return next;
}

export function deleteCoupon(code: string) {
  const all = getCoupons().filter((c) => c.code !== code.trim().toUpperCase());
  saveCoupons(all);
}

export interface CouponValidation {
  ok: boolean;
  error?: string;
  coupon?: Coupon;
  discount?: number;     // potongan IDR
  finalPrice?: number;   // harga setelah diskon
}

export function validateCoupon(rawCode: string, userId: string, basePrice: number): CouponValidation {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, error: "Kode kupon kosong." };
  const c = getCoupons().find((x) => x.code === code);
  if (!c) return { ok: false, error: "Kode kupon tidak ditemukan." };
  if (!c.active) return { ok: false, error: "Kupon sedang non-aktif." };
  if (c.expiresAt && new Date(c.expiresAt).getTime() < Date.now())
    return { ok: false, error: "Kupon sudah kedaluwarsa." };
  if (c.maxRedemptions > 0 && c.totalRedemptions >= c.maxRedemptions)
    return { ok: false, error: "Kuota kupon habis." };
  const used = c.redemptions[userId] || 0;
  if (c.perUserLimit > 0 && used >= c.perUserLimit)
    return { ok: false, error: `Kamu sudah memakai kupon ini ${used}x (batas ${c.perUserLimit}x).` };
  let discount = c.type === "percent" ? Math.floor((basePrice * c.value) / 100) : c.value;
  if (discount > basePrice) discount = basePrice;
  if (discount < 0) discount = 0;
  return { ok: true, coupon: c, discount, finalPrice: Math.max(0, basePrice - discount) };
}

/** Tandai kupon sudah dipakai (panggil saat order dibuat / dibayar). */
export function redeemCoupon(code: string, userId: string) {
  const all = getCoupons();
  const idx = all.findIndex((x) => x.code === code.trim().toUpperCase());
  if (idx < 0) return;
  const c = all[idx];
  c.totalRedemptions += 1;
  c.redemptions[userId] = (c.redemptions[userId] || 0) + 1;
  all[idx] = c;
  saveCoupons(all);
}

// ─── Profile updates ───────────────────────────────────────────────────────
export function updateUserProfile(
  userId: string,
  patch: Partial<Pick<User, "nickname" | "bio" | "avatarBase64" | "email">>,
): User | null {
  const all = getUsers();
  const idx = all.findIndex((u) => u.id === userId);
  if (idx < 0) return null;
  all[idx] = { ...all[idx], ...patch };
  saveUsers(all);
  // sync session if it's me
  const sess = getSession();
  if (sess && sess.id === userId) setSession(all[idx]);
  return all[idx];
}

export function setUserPin(userId: string, pin: string | null): User | null {
  const all = getUsers();
  const idx = all.findIndex((u) => u.id === userId);
  if (idx < 0) return null;
  if (pin == null || pin === "") {
    delete (all[idx] as any).pin;
  } else {
    if (!/^\d{4,6}$/.test(pin)) return null;
    all[idx] = { ...all[idx], pin };
  }
  saveUsers(all);
  const sess = getSession();
  if (sess && sess.id === userId) setSession(all[idx]);
  return all[idx];
}

export function verifyUserPin(userId: string, pin: string): boolean {
  const u = getUsers().find((x) => x.id === userId);
  if (!u || !u.pin) return false;
  return u.pin === pin;
}

// ─── Level / Badge ─────────────────────────────────────────────────────────
export interface UserLevel {
  tier: "Bronze" | "Silver" | "Gold" | "VIP";
  totalSpend: number;
  next?: { tier: string; need: number };
  color: string;
  gradient: string;
}

const TIERS: { tier: UserLevel["tier"]; min: number; color: string; gradient: string }[] = [
  { tier: "Bronze", min: 0,         color: "#cd7f32", gradient: "from-amber-700 to-amber-500" },
  { tier: "Silver", min: 500_000,   color: "#c0c0c0", gradient: "from-slate-400 to-slate-200" },
  { tier: "Gold",   min: 2_500_000, color: "#facc15", gradient: "from-yellow-500 to-amber-300" },
  { tier: "VIP",    min: 10_000_000,color: "#a855f7", gradient: "from-fuchsia-500 to-purple-400" },
];

export function getUserTotalSpend(userId: string): number {
  return getOrders()
    .filter((o) => o.userId === userId && (o.status === "verified" || o.status === "paid"))
    .reduce((s, o) => s + (o.finalPriceIDR ?? o.variantPrice), 0);
}

export function getUserLevel(userId: string): UserLevel {
  const total = getUserTotalSpend(userId);
  let cur = TIERS[0];
  for (const t of TIERS) if (total >= t.min) cur = t;
  const idx = TIERS.findIndex((t) => t.tier === cur.tier);
  const nxt = TIERS[idx + 1];
  return {
    tier: cur.tier,
    totalSpend: total,
    color: cur.color,
    gradient: cur.gradient,
    next: nxt ? { tier: nxt.tier, need: nxt.min - total } : undefined,
  };
}

// ─── Leaderboard (real + dummy) ────────────────────────────────────────────
export interface LeaderboardRow {
  rank: number;
  userId: string;
  username: string;
  nickname?: string;
  avatarBase64?: string;
  totalSpend: number;
  totalOrders: number;
  tier: UserLevel["tier"];
  isDummy: boolean;
  isMe?: boolean;
}

function startOfThisMonthMs(): number {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

export function getLeaderboard(meId?: string, limit = 50): LeaderboardRow[] {
  const since = startOfThisMonthMs();
  // Real
  const realOrders = getOrders().filter(
    (o) => (o.status === "verified" || o.status === "paid") &&
      new Date(o.createdAt).getTime() >= since,
  );
  const realUsers = getUsers();
  const realMap = new Map<string, { spend: number; orders: number }>();
  realOrders.forEach((o) => {
    const cur = realMap.get(o.userId) || { spend: 0, orders: 0 };
    cur.spend += o.finalPriceIDR ?? o.variantPrice;
    cur.orders += 1;
    realMap.set(o.userId, cur);
  });

  // Dummy (deterministic per month)
  const dummyUsers = getDummyCommunityUsers();
  const monthSeed = Math.floor(since / 1_000_000);
  const rng = (i: number) => {
    let x = (monthSeed * 9301 + i * 49297 + 233280) % 233280;
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    return (x % 1000) / 1000;
  };
  const dummyRows: LeaderboardRow[] = dummyUsers.slice(0, 200).map((u, i) => {
    // varied spends, pareto-shaped
    const r = rng(i);
    const base = Math.floor(150_000 + r * r * r * 14_000_000);
    const orders = Math.max(1, Math.floor(2 + r * 38));
    return {
      rank: 0,
      userId: u.id,
      username: u.username,
      nickname: u.nickname,
      avatarBase64: u.avatarBase64,
      totalSpend: base,
      totalOrders: orders,
      tier: getTierFromSpend(base),
      isDummy: true,
    };
  });

  const realRows: LeaderboardRow[] = Array.from(realMap.entries()).map(([uid, v]) => {
    const u = realUsers.find((x) => x.id === uid);
    return {
      rank: 0,
      userId: uid,
      username: u?.username || "user",
      nickname: u?.nickname,
      avatarBase64: u?.avatarBase64,
      totalSpend: v.spend,
      totalOrders: v.orders,
      tier: getTierFromSpend(v.spend),
      isDummy: false,
    };
  });

  // Make sure "me" appears even tanpa pembelian bulan ini
  if (meId && !realRows.find((r) => r.userId === meId)) {
    const u = realUsers.find((x) => x.id === meId);
    if (u) {
      realRows.push({
        rank: 0, userId: meId, username: u.username,
        nickname: u.nickname, avatarBase64: u.avatarBase64,
        totalSpend: 0, totalOrders: 0,
        tier: getTierFromSpend(0), isDummy: false,
      });
    }
  }

  const merged = [...realRows, ...dummyRows]
    .sort((a, b) => b.totalSpend - a.totalSpend)
    .slice(0, limit)
    .map((r, i) => ({ ...r, rank: i + 1, isMe: r.userId === meId }));

  return merged;
}

function getTierFromSpend(s: number): UserLevel["tier"] {
  let cur: UserLevel["tier"] = "Bronze";
  for (const t of TIERS) if (s >= t.min) cur = t.tier;
  return cur;
}

// ─── Warranty / Key services ───────────────────────────────────────────────
export const DEFAULT_WARRANTY_DAYS = 30;
export const MAX_REPLACEMENTS = 1;

export function warrantyInfo(o: Order): {
  totalDays: number;
  daysLeft: number;
  expiresAt: number;
  active: boolean;
} {
  const total = o.warrantyDays ?? DEFAULT_WARRANTY_DAYS;
  const start = new Date(o.updatedAt || o.createdAt).getTime();
  const expires = start + total * 86_400_000;
  const left = Math.max(0, Math.ceil((expires - Date.now()) / 86_400_000));
  return { totalDays: total, daysLeft: left, expiresAt: expires, active: left > 0 };
}

export function claimWarranty(orderId: string): { ok: boolean; error?: string } {
  const all = getOrders();
  const idx = all.findIndex((o) => o.id === orderId);
  if (idx < 0) return { ok: false, error: "Order tidak ditemukan." };
  const o = all[idx];
  if (o.status !== "verified" && o.status !== "paid")
    return { ok: false, error: "Order belum lunas." };
  const w = warrantyInfo(o);
  if (!w.active) return { ok: false, error: "Garansi sudah habis." };
  if (o.warrantyClaimedAt) return { ok: false, error: "Garansi sudah pernah diklaim." };
  all[idx] = { ...o, warrantyClaimedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  saveOrders(all);
  return { ok: true };
}

export function replaceKey(orderId: string): { ok: boolean; error?: string; newKey?: string } {
  const all = getOrders();
  const idx = all.findIndex((o) => o.id === orderId);
  if (idx < 0) return { ok: false, error: "Order tidak ditemukan." };
  const o = all[idx];
  if (!o.key) return { ok: false, error: "Order belum punya key." };
  if (o.replacedAt) return { ok: false, error: "Key sudah pernah diganti (maks 1×)." };
  const w = warrantyInfo(o);
  if (!w.active) return { ok: false, error: "Replace hanya berlaku selama masa garansi." };

  let newKey = "";
  try {
    newKey = popStockKey(o.productId, o.variantId);
  } catch {
    return { ok: false, error: "Stok key kosong, hubungi admin." };
  }
  const oldKeys = [...(o.oldKeys || []), o.key];
  all[idx] = {
    ...o,
    key: newKey,
    oldKeys,
    replacedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveOrders(all);
  return { ok: true, newKey };
}

// ─── Deposit (QRIS Manual) ─────────────────────────────────────────────────
export interface DepositCreateResponse {
  depositId: string;
  uniqueCode: number;
  totalAmount: number;
  qrImage: string;   // data URL or remote URL
  qrString: string;  // raw EMV/QRIS payload
  expiredAt: string; // ISO timestamp
}

export interface DepositStatusResponse {
  status: "pending" | "success" | "already";
  depositId: string;
  amount?: number;
  paidAt?: string;
}

/**
 * Buat deposit QRIS MANUAL — tidak ada gateway pihak ketiga.
 * Sistem cuma bikin ID deposit + kode unik (untuk membantu admin
 * mencocokkan pembayaran), lalu menampilkan gambar QRIS statis yang
 * di-upload admin di halaman Pengaturan.
 */
export async function createDeposit(
  amount: number,
  _method: "qris" = "qris",
): Promise<DepositCreateResponse> {
  const s = getPaymentSettings();
  const uniqueCode = Math.floor(100 + Math.random() * 900);
  const totalAmount = amount + uniqueCode;
  const depositId = `DEP${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const qrString = `QRIS|DEP:${depositId}|AMT:${totalAmount}`;
  return {
    depositId,
    uniqueCode,
    totalAmount,
    qrImage: s.qrisImageBase64 || "",
    qrString,
    expiredAt: new Date(Date.now() + 15 * 60_000).toISOString(),
  };
}

/**
 * Mode manual: status selalu "pending" sampai admin / pembeli klik tombol
 * "Saya Sudah Membayar". Tidak ada polling otomatis ke gateway.
 */
export async function getDepositStatus(depositId: string): Promise<DepositStatusResponse> {
  return { status: "pending", depositId };
}

// ─── Storage Maintenance Helpers ───────────────────────────────────────────
/**
 * Keys yang aman dihapus tanpa kehilangan data penting (cache, dummy, log,
 * notif transient). Menjalankan clearSafeCaches() biasanya cukup untuk
 * mengatasi quota penuh di browser.
 */
const SAFE_CACHE_KEYS = [
  "pinz_dummy_seeded_v1",
  "pinz_dummy_seeded_v2",
  "pinz_dummy_orders",
  "pinz_dummy_users",
  "pinz_purchase_notifs",
  "pinz_chat",
  "pinz_chat_messages",
  "pinz_chat_unread",
  "pinz_chat_new",
  "pinz_activity_log",
  "pinz_broadcast",
  "pinz_broadcast_seen",
  "pinz_inapp_notif",
  "pinz_inapp_notifs",
  "pinz_new_purchase",
  "pinz_dismissed_sched",
  "pinz_impersonate_origin",
  "pinz_admin_open_tab",
  "pinz_stok",
];

/**
 * Keys yang HARUS dipertahankan saat reset total. Menjaga login admin tetap
 * aktif sehingga tidak terkunci dari panel.
 */
const PROTECTED_KEYS_ON_FULL_RESET = [
  "pinz_session",
  "pinz_device_id",
  "pinz_app_version",
];

export interface StorageUsage {
  totalBytes: number;
  totalKeys: number;
  pinzBytes: number;
  pinzKeys: number;
  safeCacheBytes: number;
  topKeys: Array<{ key: string; bytes: number }>;
}

export function getStorageUsage(): StorageUsage {
  let totalBytes = 0;
  let totalKeys = 0;
  let pinzBytes = 0;
  let pinzKeys = 0;
  let safeCacheBytes = 0;
  const sizes: Array<{ key: string; bytes: number }> = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    const v = localStorage.getItem(k) || "";
    // UTF-16: 2 bytes per char (perkiraan kasar quota browser).
    const bytes = (k.length + v.length) * 2;
    totalBytes += bytes;
    totalKeys += 1;
    if (k.startsWith("pinz_")) {
      pinzBytes += bytes;
      pinzKeys += 1;
      sizes.push({ key: k, bytes });
      if (SAFE_CACHE_KEYS.includes(k)) safeCacheBytes += bytes;
    }
  }
  sizes.sort((a, b) => b.bytes - a.bytes);
  return {
    totalBytes,
    totalKeys,
    pinzBytes,
    pinzKeys,
    safeCacheBytes,
    topKeys: sizes.slice(0, 8),
  };
}

export function clearSafeCaches(): { keysRemoved: number; bytesFreed: number } {
  let keysRemoved = 0;
  let bytesFreed = 0;
  for (const k of SAFE_CACHE_KEYS) {
    const v = localStorage.getItem(k);
    if (v !== null) {
      bytesFreed += (k.length + v.length) * 2;
      localStorage.removeItem(k);
      keysRemoved += 1;
    }
  }
  return { keysRemoved, bytesFreed };
}

export function resetAllStorageExceptSession(): { keysRemoved: number; bytesFreed: number } {
  const toRemove: string[] = [];
  let bytesFreed = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (PROTECTED_KEYS_ON_FULL_RESET.includes(k)) continue;
    const v = localStorage.getItem(k) || "";
    bytesFreed += (k.length + v.length) * 2;
    toRemove.push(k);
  }
  toRemove.forEach((k) => localStorage.removeItem(k));
  return { keysRemoved: toRemove.length, bytesFreed };
}

export function backupKeyToEmail(orderId: string, email: string): { ok: boolean; error?: string } {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { ok: false, error: "Email tidak valid." };
  const all = getOrders();
  const idx = all.findIndex((o) => o.id === orderId);
  if (idx < 0) return { ok: false, error: "Order tidak ditemukan." };
  const o = all[idx];
  if (!o.key) return { ok: false, error: "Belum ada key." };
  // Simulasi pengiriman (frontend-only); catat timestamp.
  all[idx] = { ...o, backupSentAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  saveOrders(all);
  return { ok: true };
}
