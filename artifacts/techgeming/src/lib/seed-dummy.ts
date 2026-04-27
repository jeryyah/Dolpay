import { getAllProducts, getOrders, saveOrders, generateOrderId, type Order } from "./storage";

const DUMMY_FLAG = "pinz_dummy_seeded_v2";
const LEGACY_FLAGS = ["pinz_dummy_seeded_v1"];
const DUMMY_USERS = [
  { id: "dummy-u1", username: "rifqi_mod", buyerName: "Rifqi Pratama" },
  { id: "dummy-u2", username: "andini.dev", buyerName: "Andini Aziza" },
  { id: "dummy-u3", username: "bayu_root", buyerName: "Bayu Setiawan" },
  { id: "dummy-u4", username: "naufal_cheat", buyerName: "Naufal Hidayat" },
  { id: "dummy-u5", username: "sintya.app", buyerName: "Sintya Rahma" },
  { id: "dummy-u6", username: "rendi_vphone", buyerName: "Rendi Saputra" },
  { id: "dummy-u7", username: "dewi.client", buyerName: "Dewi Ayu" },
  { id: "dummy-u8", username: "fauzan_team", buyerName: "Fauzan Akbar" },
  { id: "dummy-u9", username: "tasya_hook", buyerName: "Tasya Lestari" },
  { id: "dummy-u10", username: "irfan_drip", buyerName: "Irfan Zairi" },
];

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomKey(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 16; i++) {
    if (i > 0 && i % 4 === 0) s += "-";
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

/** Build dummy orders from the *current* (admin-managed) product catalog. */
function buildDummyOrders(): Order[] {
  const products = getAllProducts().filter((p) => p.variants && p.variants.length > 0);
  if (products.length === 0) return [];

  const now = Date.now();
  const orders: Order[] = [];

  // Spread orders across the past 14 days, weighted heavier toward recent
  for (let dayAgo = 13; dayAgo >= 0; dayAgo--) {
    const ordersToday = dayAgo < 3 ? randInt(4, 7) : dayAgo < 7 ? randInt(2, 5) : randInt(1, 3);
    for (let i = 0; i < ordersToday; i++) {
      const product = rand(products);
      const variant = rand(product.variants);
      const user = rand(DUMMY_USERS);
      const created = new Date(
        now - dayAgo * 24 * 60 * 60 * 1000 - randInt(0, 23) * 60 * 60 * 1000 - randInt(0, 59) * 60 * 1000,
      );
      const isVerified = Math.random() < 0.85;
      const status: Order["status"] = isVerified ? "verified" : rand(["pending_verify", "paid", "cancelled"]);
      const method: Order["paymentMethod"] = Math.random() < 0.7 ? "qris" : "usdt";

      orders.push({
        id: generateOrderId(created),
        userId: user.id,
        username: user.username,
        productId: product.id,
        productName: product.title,
        variantId: variant.id,
        variantLabel: variant.label,
        variantPrice: variant.price,
        buyerName: user.buyerName,
        paymentMethod: method,
        status,
        key: status === "verified" ? randomKey() : undefined,
        amountUSDT: method === "usdt" ? Number((variant.price / 16200).toFixed(2)) : undefined,
        finalPriceIDR: variant.price,
        warrantyDays: 30,
        createdAt: created.toISOString(),
        updatedAt: created.toISOString(),
        activatedAt: status === "verified" ? created.getTime() : undefined,
      });
    }
  }

  return orders;
}

export function seedDummyOrdersIfEmpty(): void {
  if (typeof window === "undefined") return;

  // Clear any legacy seed flags so old dummy data (with stale product names)
  // is not considered "already seeded".
  for (const f of LEGACY_FLAGS) {
    if (localStorage.getItem(f)) localStorage.removeItem(f);
  }

  if (localStorage.getItem(DUMMY_FLAG)) return;
  if (getOrders().length > 0) {
    localStorage.setItem(DUMMY_FLAG, "1");
    return;
  }

  const orders = buildDummyOrders();
  if (orders.length === 0) return;

  saveOrders(orders);
  localStorage.setItem(DUMMY_FLAG, "1");
}

/** Wipe existing dummy orders and reseed from the current product catalog. */
export function reseedDummyOrders(): number {
  if (typeof window === "undefined") return 0;
  const existing = getOrders();
  // Keep any real (non-dummy) orders — only drop those tied to dummy users.
  const dummyUserIds = new Set(DUMMY_USERS.map((u) => u.id));
  const realOrders = existing.filter((o) => !dummyUserIds.has(o.userId));
  const fresh = buildDummyOrders();
  saveOrders([...realOrders, ...fresh]);
  localStorage.setItem(DUMMY_FLAG, "1");
  return fresh.length;
}
