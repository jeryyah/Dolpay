import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle } from "lucide-react";
import {
  getAllProducts,
  makeSyntheticNotif,
  pushDummyOrder,
  type PurchaseNotif,
} from "@/lib/storage";

// Global "PEMBELIAN BARU" toast that lives outside the admin panel.
// - Real verified orders push a `pinz_new_purchase` event from storage.ts;
//   when that fires, we surface it on every page (history, home, etc.).
// - When idle (no real activity for a while), we drop in a low-rate synthetic
//   notification using the LIVE catalog so brand-new admin-created products
//   show up immediately. The synthetic stream pauses entirely when there are
//   no products configured yet so the toast never says "—".
const REAL_TOAST_MS = 5000;
const SYNTH_TOAST_MS = 4500;
const SYNTH_MIN_GAP = 18_000;
const SYNTH_MAX_GAP = 38_000;

export function LivePurchaseToast() {
  const [location] = useLocation();
  const [toast, setToast] = useState<PurchaseNotif | null>(null);
  const hideTimer = useRef<number | null>(null);
  const synthTimer = useRef<number | null>(null);

  // Don't double up with the admin page (which has its own ticker).
  const onAdmin = location === "/admin" || location.startsWith("/admin/");
  // Hide on payment screens to avoid distracting the buyer mid-checkout.
  const onPayment = location.startsWith("/payment/") || location === "/login";
  const enabled = !onAdmin && !onPayment;

  useEffect(() => {
    if (!enabled) {
      setToast(null);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (synthTimer.current) clearTimeout(synthTimer.current);
      return;
    }

    const showToast = (n: PurchaseNotif, ms: number) => {
      setToast(n);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(() => setToast(null), ms);
    };

    const onRealPurchase = (e: Event) => {
      const detail = (e as CustomEvent<PurchaseNotif>).detail;
      if (detail) showToast(detail, REAL_TOAST_MS);
    };
    window.addEventListener("pinz_new_purchase", onRealPurchase);

    const tick = () => {
      // Skip synthetic toast entirely until the owner has at least one product
      // — otherwise we'd surface a placeholder name and confuse the user.
      const hasProducts = getAllProducts().some((p) => p.variants?.length > 0);
      if (hasProducts) {
        const notif = makeSyntheticNotif();
        // Also push an in-memory dummy order so dashboard counters tick along
        // for non-admin viewers (they just see the visible toast).
        pushDummyOrder();
        showToast(notif, SYNTH_TOAST_MS);
      }
      const next = SYNTH_MIN_GAP + Math.random() * (SYNTH_MAX_GAP - SYNTH_MIN_GAP);
      synthTimer.current = window.setTimeout(tick, next);
    };
    // First synthetic appears ~10s after page load so real visitors see it.
    synthTimer.current = window.setTimeout(tick, 10_000);

    return () => {
      window.removeEventListener("pinz_new_purchase", onRealPurchase);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (synthTimer.current) clearTimeout(synthTimer.current);
    };
  }, [enabled]);

  if (!toast || !toast.productName || toast.productName === "—") return null;

  return (
    <div className="fixed bottom-4 right-4 z-[400] animate-in slide-in-from-bottom-5 fade-in duration-500 pointer-events-none">
      <div className="bg-card border border-green-500/40 rounded-2xl shadow-2xl shadow-green-500/10 px-4 py-3 max-w-xs flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-green-500/15 flex items-center justify-center shrink-0">
          <CheckCircle className="w-5 h-5 text-green-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-green-400 font-bold mb-0.5">PEMBELIAN BARU</p>
          <p className="text-sm font-bold truncate">@{toast.username}</p>
          {toast.synthetic ? (
            <p className="text-xs text-muted-foreground truncate">beli {toast.productName}</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground truncate">
                {toast.productName} · {toast.variantLabel}
              </p>
              {toast.key && (
                <code className="text-[10px] font-mono text-primary mt-0.5 block truncate">
                  {toast.key}
                </code>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
