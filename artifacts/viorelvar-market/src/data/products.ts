export type ProductCategory = string;
export const DEFAULT_CATEGORIES: { id: string; label: string }[] = [];

export const REMOVED_CATEGORY_IDS: string[] = [
  "game-topup",
  "voucher",
  "app-premium",
  "joki",
  "key-appmod",
  "app-virtual",
];

export interface ProductVariant {
  id: string;
  label: string;
  price: number;
}

export interface Product {
  id: string;
  title: string;
  publisher: string;
  category: ProductCategory;
  price: number;
  originalPrice?: number;
  imageUrl: string;
  isHot?: boolean;
  soldCount: number;
  variants: ProductVariant[];
}

// Hardcoded base catalog intentionally empty: the live store ships only with
// the four admin-curated products injected by `seed-custom-products.ts`
// (Dripclient no root, PATO TEAM, VIRTUAL VPHONE, PRIME HOOK). Anything else
// the admin adds via the panel is stored in `pinz_extra_products`.
export const PRODUCTS: Product[] = [];
