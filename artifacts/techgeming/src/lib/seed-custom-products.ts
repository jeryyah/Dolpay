import type { Product } from "@/data/products";
import { REMOVED_CATEGORY_IDS } from "@/data/products";
import { getCategories, saveCategories, getPublishers, savePublishers } from "./storage";

const SEED_FLAG = "pinz_custom_products_seeded_v2";
const REMOVE_FLAG = "pinz_default_categories_removed_v2";
const CATEGORY_MIGRATE_FLAG = "pinz_categories_apkmod_root_v1";
const SOLD_BUMP_FLAG = "pinz_sold_count_bump_v2";
const VARIANT_BUMP_FLAG = "pinz_variants_bump_v1";

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
  { id: "apkmod", label: "APKMOD" },
  { id: "root",   label: "ROOT" },
];

const SEED_PUBLISHERS: string[] = ["CLIENT", "TEAM", "ROOT/NOROT", "CHEAT"];

const SEED_PRODUCTS: Product[] = [
  {
    id: "custom-dripclient-no-root",
    title: "Dripclient no root",
    publisher: "CLIENT",
    category: "apkmod",
    price: 25000,
    originalPrice: 186000,
    imageUrl: "https://placehold.co/600x600/7c3aed/ffffff?text=DRIPCLIENT%0Ano+root",
    isHot: true,
    soldCount: 5400,
    variants: [
      { id: "1d",  label: "1 Hari",  price: 25000  },
      { id: "7d",  label: "7 Hari",  price: 75000  },
      { id: "14d", label: "14 Hari", price: 130000 },
      { id: "30d", label: "30 Hari", price: 186000 },
    ],
  },
  {
    id: "custom-pato-team",
    title: "PATO TEAM",
    publisher: "TEAM",
    category: "apkmod",
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
    category: "root",
    price: 25000,
    imageUrl: "https://placehold.co/600x600/0891b2/ffffff?text=VIRTUAL%0AVPHONE",
    soldCount: 3200,
    variants: [
      { id: "trial", label: "TRIAL 7 HARI", price: 25000  },
      { id: "60d",   label: "60 HARI",      price: 150000 },
    ],
  },
  {
    id: "custom-hg-no-root",
    title: "HG NO ROOT",
    publisher: "CLIENT",
    category: "apkmod",
    price: 20000,
    originalPrice: 160000,
    imageUrl: "https://placehold.co/600x600/dc2626/ffffff?text=HG+NO%0AROOT",
    isHot: true,
    soldCount: 3130,
    variants: [
      { id: "1d",  label: "1 Hari",  price: 20000  },
      { id: "7d",  label: "7 Hari",  price: 65000  },
      { id: "14d", label: "14 Hari", price: 110000 },
      { id: "30d", label: "30 Hari", price: 160000 },
    ],
  },
  {
    id: "custom-prime-hook",
    title: "PRIME HOOK",
    publisher: "CHEAT",
    category: "apkmod",
    price: 15000,
    imageUrl: "https://placehold.co/600x600/65a30d/ffffff?text=PRIME+HOOK",
    soldCount: 1200,
    variants: [
      { id: "1d",  label: "1 Hari",  price: 15000  },
      { id: "7d",  label: "7 Hari",  price: 50000  },
      { id: "14d", label: "14 Hari", price: 85000  },
      { id: "30d", label: "30 Hari", price: 120000 },
    ],
  },
];

/**
 * One-time updates to product `variants` for existing localStorage products,
 * so returning users get the new 4-variant lineups (Dripclient, HG NO ROOT,
 * PRIME HOOK). Matched by product `id` OR by `title` (case-insensitive) so
 * admin-created products are also refreshed.
 */
const VARIANT_OVERRIDES_BY_TITLE: Record<string, Product["variants"]> = {
  "dripclient no root": [
    { id: "1d",  label: "1 Hari",  price: 25000  },
    { id: "7d",  label: "7 Hari",  price: 75000  },
    { id: "14d", label: "14 Hari", price: 130000 },
    { id: "30d", label: "30 Hari", price: 186000 },
  ],
  "hg no root": [
    { id: "1d",  label: "1 Hari",  price: 20000  },
    { id: "7d",  label: "7 Hari",  price: 65000  },
    { id: "14d", label: "14 Hari", price: 110000 },
    { id: "30d", label: "30 Hari", price: 160000 },
  ],
  "prime hook": [
    { id: "1d",  label: "1 Hari",  price: 15000  },
    { id: "7d",  label: "7 Hari",  price: 50000  },
    { id: "14d", label: "14 Hari", price: 85000  },
    { id: "30d", label: "30 Hari", price: 120000 },
  ],
};

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

    // One-time migration: remap any existing extra products whose category id
    // points at the old taxonomy (key-appmod / app-virtual / game-topup / ...)
    // onto the new APKMOD / ROOT pair, and clean up matching overrides too.
    if (!localStorage.getItem(CATEGORY_MIGRATE_FLAG)) {
      const remap: Record<string, string> = {
        "key-appmod": "apkmod",
        "app-virtual": "root",
        "game-topup": "apkmod",
        "voucher": "apkmod",
        "app-premium": "apkmod",
        "joki": "apkmod",
      };
      try {
        const rawX = localStorage.getItem("pinz_extra_products");
        if (rawX) {
          const listX: Product[] = JSON.parse(rawX);
          let changed = false;
          for (const p of listX) {
            const next = remap[p.category];
            if (next) {
              p.category = next;
              changed = true;
            }
          }
          if (changed) {
            localStorage.setItem("pinz_extra_products", JSON.stringify(listX));
          }
        }
      } catch {}
      try {
        const rawO = localStorage.getItem("pinz_product_overrides");
        if (rawO) {
          const overrides = JSON.parse(rawO) as Record<string, { category?: string }>;
          let changed = false;
          for (const k of Object.keys(overrides)) {
            const ov = overrides[k];
            if (ov && typeof ov.category === "string" && remap[ov.category]) {
              ov.category = remap[ov.category];
              changed = true;
            }
          }
          if (changed) {
            localStorage.setItem("pinz_product_overrides", JSON.stringify(overrides));
          }
        }
      } catch {}
      localStorage.setItem(CATEGORY_MIGRATE_FLAG, "1");
    }

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

    // One-time migration: refresh variant lineups for existing localStorage
    // products so returning users see the new 4-variant options for
    // Dripclient, HG NO ROOT, and PRIME HOOK.
    if (!localStorage.getItem(VARIANT_BUMP_FLAG)) {
      const raw3 = localStorage.getItem("pinz_extra_products");
      if (raw3) {
        try {
          const list3: Product[] = JSON.parse(raw3);
          let bumped = false;
          for (const p of list3) {
            const titleKey = p.title.trim().toLowerCase();
            const newVariants = VARIANT_OVERRIDES_BY_TITLE[titleKey];
            if (newVariants) {
              p.variants = newVariants.map((v) => ({ ...v }));
              bumped = true;
            }
          }
          if (bumped) {
            localStorage.setItem("pinz_extra_products", JSON.stringify(list3));
          }
        } catch {}
      }
      localStorage.setItem(VARIANT_BUMP_FLAG, "1");
    }
  } catch {
    // Storage unavailable / quota — fail silently, admin can re-add manually.
  }
}
