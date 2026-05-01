import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./lib/i18n";
import { ErrorBoundary, installGlobalErrorHandlers } from "./components/error-boundary";
import { primeCloudSync, startCloudSync } from "./lib/cloud-sync";

installGlobalErrorHandlers();
// Seed demo products on first visit so the catalog isn't empty for new guests.
try {
  // Lazy import to avoid pulling on every reload after seed.
  if (typeof window !== "undefined" && !localStorage.getItem("techgeming_seed_v1")) {
    import("./lib/seed-custom-products").then((m) => {
      m.seedCustomProductsIfMissing?.();
      localStorage.setItem("techgeming_seed_v1", "1");
      window.dispatchEvent(new CustomEvent("pinz:storage", { detail: { key: "pinz_extra_products" } }));
    });
  }
} catch {}
// NOTE: `seedCustomProductsIfMissing()` deliberately NOT called here. The
// admin product catalog is now sourced exclusively from the live cloud
// (Netlify Blobs) — see cloud-sync.ts. Auto-seeding placeholder products
// (Dripclient / PATO TEAM / VIRTUAL VPHONE / PRIME HOOK with
// placehold.co images) would re-inject demo data on every fresh device
// and override admin's real catalog. Admin manages the catalog through
// the admin panel; new visitors receive only what admin has published.

// One-time cleanup: previous builds auto-seeded 4 placeholder products
// into pinz_extra_products on first load. Strip them from any device
// that still has them so the live catalog reflects only admin's real
// products. Idempotent via `pinz_demo_cleanup_v1` flag.
try {
  const CLEANUP_FLAG = "pinz_demo_cleanup_v1";
  if (typeof window !== "undefined" && !localStorage.getItem(CLEANUP_FLAG)) {
    const DEMO_IDS = new Set([
      "custom-dripclient-no-root",
      "custom-pato-team",
      "custom-virtual-vphone",
      "custom-prime-hook",
    ]);
    const rawList = localStorage.getItem("pinz_extra_products");
    if (rawList) {
      try {
        const list: Array<{ id: string }> = JSON.parse(rawList);
        const kept = list.filter((p) => !DEMO_IDS.has(p.id));
        if (kept.length !== list.length) {
          localStorage.setItem("pinz_extra_products", JSON.stringify(kept));
          window.dispatchEvent(
            new CustomEvent("pinz:storage", {
              detail: { key: "pinz_extra_products" },
            }),
          );
        }
      } catch {}
    }
    const rawOv = localStorage.getItem("pinz_product_overrides");
    if (rawOv) {
      try {
        const ov: Record<string, unknown> = JSON.parse(rawOv);
        let changed = false;
        for (const id of DEMO_IDS) {
          if (id in ov) {
            delete ov[id];
            changed = true;
          }
        }
        if (changed) {
          localStorage.setItem("pinz_product_overrides", JSON.stringify(ov));
          window.dispatchEvent(
            new CustomEvent("pinz:storage", {
              detail: { key: "pinz_product_overrides" },
            }),
          );
        }
      } catch {}
    }
    localStorage.removeItem("pinz_custom_products_seeded_v1");
    localStorage.setItem(CLEANUP_FLAG, "1");
  }
} catch {}

const root = createRoot(document.getElementById("root")!);

// Pull the latest world snapshot from the server BEFORE first render so
// brand-new visitors see the exact same products / payment / prices that
// admin has set, instead of stale seed defaults. Wait at most 5s; if the
// network is unreachable we render anyway with the local cache and
// reconcile as soon as the next pull succeeds. The longer timeout (was
// 1500ms) gives slow connections a real chance to finish the snapshot
// before render, which is also required for the cloud-sync admin-push
// safety guard to unlock pushes.
primeCloudSync(5000).finally(() => {
  startCloudSync(2000);
  root.render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>,
  );
});
