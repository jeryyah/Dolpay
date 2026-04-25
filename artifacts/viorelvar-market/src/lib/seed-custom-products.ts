import type { Product } from "@/data/products";
import { REMOVED_CATEGORY_IDS } from "@/data/products";
import { getCategories, saveCategories, getPublishers, savePublishers } from "./storage";

const SEED_FLAG = "pinz_custom_products_seeded_v1";
const REMOVE_FLAG = "pinz_default_categories_removed_v1";
const SOLD_BUMP_FLAG = "pinz_sold_count_bump_v1";

/**
 * One-time updates to the dummy `soldCount` of specific products. Applied to
 * existing localStorage entries so returning users see the new totals.
 */
const SOLD_COUNT_OVERRIDES: Record<string, number> = {
  "custom-dripclient-no-root": 3130,
  "custom-prime-hook": 1200,
};

const SEED_CATEGORIES: { id: string; label: string }[] = [
  { id: "key-appmod",  label: "KEY APPMOD" },
  { id: "app-virtual", label: "APP VIRTUAL" },
];

const SEED_PUBLISHERS: string[] = ["CLIENT", "TEAM", "ROOT/NOROT", "CHEAT"];

const SEED_PRODUCTS: Product[] = [
  {
    id: "custom-dripclient-no-root",
    title: "Dripclient no root",
    publisher: "CLIENT",
    category: "key-appmod",
    price: 25000,
    originalPrice: 186000,
    imageUrl: "https://placehold.co/600x600/7c3aed/ffffff?text=DRIPCLIENT%0Ano+root",
    isHot: true,
    soldCount: 3130,
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
    let added = 0;
    for (const p of SEED_PRODUCTS) {
      if (!existingIds.has(p.id)) {
        list.push(p);
        added++;
      }
    }
    if (added > 0) {
      localStorage.setItem("pinz_extra_products", JSON.stringify(list));
    }
    localStorage.setItem(SEED_FLAG, "1");

    // One-time migration: refresh dummy soldCount values for existing
    // localStorage entries so returning users see the new totals.
    if (!localStorage.getItem(SOLD_BUMP_FLAG)) {
      const raw2 = localStorage.getItem("pinz_extra_products");
      if (raw2) {
        try {
          const list2: Product[] = JSON.parse(raw2);
          let bumped = false;
          for (const p of list2) {
            if (p.id in SOLD_COUNT_OVERRIDES) {
              p.soldCount = SOLD_COUNT_OVERRIDES[p.id];
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
