import type { Product } from "@/data/products";
import { REMOVED_CATEGORY_IDS } from "@/data/products";
import { getCategories, saveCategories, getPublishers, savePublishers } from "./storage";

const SEED_FLAG = "pinz_custom_products_seeded_v1";
const REMOVE_FLAG = "pinz_default_categories_removed_v1";
const SOLD_BUMP_FLAG = "pinz_sold_count_bump_v2";

/**
 * One-time updates to the dummy `soldCount` of specific products. Matched by
 * product `id` (exact) OR by `title` (case-insensitive) so that products the
 * admin created manually via the UI also get refreshed.
 */
const SOLD_COUNT_OVERRIDES_BY_ID: Record<string, number> = {
  "custom-hg-no-root": 3130,
  "custom-prime-hook": 1200,
};
const SOLD_COUNT_OVERRIDES_BY_TITLE: Record<string, number> = {
  "hg no root": 3130,
  "prime hook": 1200,
};

const SEED_CATEGORIES: { id: string; label: string }[] = [
  { id: "key-appmod",  label: "KEY APPMOD" },
  { id: "app-virtual", label: "APP VIRTUAL" },
];

const SEED_PUBLISHERS: string[] = ["CLIENT", "TEAM", "ROOT/NOROT", "CHEAT"];

const SEED_PRODUCTS: Product[] = [
  {
    id: "custom-hg-no-root",
    title: "HG NO ROOT",
    publisher: "CLIENT",
    category: "key-appmod",
    price: 10000,
    imageUrl: "https://placehold.co/600x600/0f172a/22d3ee?text=HG+CHEATS%0ANO+ROOT",
    isHot: true,
    soldCount: 3130,
    variants: [
      { id: "1d",  label: "1 Hari",  price: 10000 },
      { id: "7d",  label: "7 Hari",  price: 50000 },
      { id: "30d", label: "30 Hari", price: 150000 },
    ],
  },
  {
    id: "custom-dripclient-no-root",
    title: "Dripclient no root",
    publisher: "CLIENT",
    category: "key-appmod",
    price: 25000,
    originalPrice: 186000,
    imageUrl: "https://placehold.co/600x600/7c3aed/ffffff?text=DRIPCLIENT%0Ano+root",
    isHot: true,
    soldCount: 5400,
    variants: [
      { id: "1d",  label: "1 Hari",  price: 25000  },
      { id: "7d",  label: "7 Hari",  price: 75000  },
      { id: "30d", label: "30 Hari", price: 186000 },
    ],
  },
  {
    id: "custom-pato-team",
    title: "PATO TEAM",
    publisher: "TEAM",
    category: "key-appmod",
    price: 50000,
    originalPrice: 54990,
    imageUrl: "https://placehold.co/600x600/16a34a/ffffff?text=PATO+TEAM",
    isHot: true,
    soldCount: 7800,
    variants: [
      { id: "1d",  label: "1 Hari",  price: 50000  },
      { id: "7d",  label: "7 Hari",  price: 150000 },
      { id: "14d", label: "14 Hari", price: 250000 },
      { id: "30d", label: "30 Hari", price: 400000 },
    ],
  },
  {
    id: "custom-virtual-vphone",
    title: "VIRTUAL VPHONE",
    publisher: "ROOT/NOROT",
    category: "app-virtual",
    price: 25000,
    imageUrl: "https://placehold.co/600x600/0891b2/ffffff?text=VIRTUAL%0AVPHONE",
    soldCount: 3200,
    variants: [
      { id: "trial", label: "TRIAL 7 HARI", price: 25000  },
      { id: "60d",   label: "60 HARI",      price: 150000 },
    ],
  },
  {
    id: "custom-prime-hook",
    title: "PRIME HOOK",
    publisher: "CHEAT",
    category: "key-appmod",
    price: 15000,
    imageUrl: "https://placehold.co/600x600/65a30d/ffffff?text=PRIME+HOOK",
    soldCount: 1200,
    variants: [
      { id: "1d",  label: "1 Hari",  price: 15000  },
      { id: "7d",  label: "7 Hari",  price: 50000  },
      { id: "30d", label: "30 Hari", price: 120000 },
    ],
  },
];

/**
 * One-time seed of the admin's original 4 custom products: Dripclient no root,
 * PATO TEAM, VIRTUAL VPHONE, PRIME HOOK. These were lost from localStorage at
 * some point, so we re-inject them on first boot. Idempotent on a per-product
 * basis: any of the 4 IDs already present in `pinz_extra_products` is left
 * untouched, so admin edits made via the UI are preserved.
 */
export function seedCustomProductsIfMissing(): void {
  if (typeof window === "undefined") return;
  try {
    // Make sure the categories and publishers used by the seed exist so the
    // products are not orphaned in the admin filters.
    let cats = getCategories();

    // One-time cleanup: strip the legacy default categories
    // (Game Top-up, Voucher, App Premium, Joki) from existing localStorage
    // caches so returning users no longer see them in the filter bar.
    if (!localStorage.getItem(REMOVE_FLAG)) {
      const removeSet = new Set(REMOVED_CATEGORY_IDS);
      const filtered = cats.filter((c) => !removeSet.has(c.id));
      if (filtered.length !== cats.length) {
        saveCategories(filtered);
        cats = filtered;
      }
      localStorage.setItem(REMOVE_FLAG, "1");
    }

    const catIds = new Set(cats.map((c) => c.id));
    let catsChanged = false;
    for (const c of SEED_CATEGORIES) {
      if (!catIds.has(c.id)) {
        cats.push(c);
        catsChanged = true;
      }
    }
    if (catsChanged) saveCategories(cats);

    const pubs = getPublishers();
    const pubSet = new Set(pubs);
    let pubsChanged = false;
    for (const p of SEED_PUBLISHERS) {
      if (!pubSet.has(p)) {
        pubs.push(p);
        pubsChanged = true;
      }
    }
    if (pubsChanged) savePublishers(pubs);

    const raw = localStorage.getItem("pinz_extra_products");
    const list: Product[] = raw ? JSON.parse(raw) : [];
    const existingIds = new Set(list.map((p) => p.id));
    const existingTitles = new Set(list.map((p) => p.title.trim().toLowerCase()));
    let added = 0;
    for (const p of SEED_PRODUCTS) {
      // Skip if a product with the same id OR same title already exists, so
      // admin-created products (e.g. their own HG NO ROOT) are not duplicated.
      if (existingIds.has(p.id) || existingTitles.has(p.title.trim().toLowerCase())) continue;
      list.push(p);
      added++;
    }
    if (added > 0) {
      localStorage.setItem("pinz_extra_products", JSON.stringify(list));
    }
    localStorage.setItem(SEED_FLAG, "1");

    // One-time migration: refresh dummy soldCount values for existing
    // localStorage entries so returning users see the new totals. Matches
    // products by id OR title (case-insensitive) so manually-created products
    // also get refreshed.
    if (!localStorage.getItem(SOLD_BUMP_FLAG)) {
      const raw2 = localStorage.getItem("pinz_extra_products");
      if (raw2) {
        try {
          const list2: Product[] = JSON.parse(raw2);
          let bumped = false;
          for (const p of list2) {
            const titleKey = p.title.trim().toLowerCase();
            const newCount =
              SOLD_COUNT_OVERRIDES_BY_ID[p.id] ?? SOLD_COUNT_OVERRIDES_BY_TITLE[titleKey];
            if (typeof newCount === "number") {
              p.soldCount = newCount;
              bumped = true;
            }
          }
          if (bumped) {
            localStorage.setItem("pinz_extra_products", JSON.stringify(list2));
          }
        } catch {}
      }
      localStorage.setItem(SOLD_BUMP_FLAG, "1");
    }
  } catch {
    // Storage unavailable / quota — fail silently, admin can re-add manually.
  }
}
