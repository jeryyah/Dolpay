import React, { useEffect, useMemo, useState } from "react";
import {
  X, ShieldCheck, Zap, Lock, BadgeCheck, ChevronDown, AlertTriangle,
  QrCode, Bitcoin, Sparkles,
} from "lucide-react";
import { type Product } from "@/data/products";
import { useAuth } from "@/lib/auth-context";
import { createOrder, canCreateOrder, toUSD, applyOverride } from "@/lib/storage";
import { formatCurrency } from "@/lib/utils";
import { useLocation } from "wouter";
import { CaptchaInput } from "@/components/captcha";
import { getUserExt, pushActivity, getTierDiscountPct, TIERS } from "@/lib/extra-storage";

interface BuyModalProps {
  product: Product;
  onClose: () => void;
}

export function BuyModal({ product: rawProduct, onClose }: BuyModalProps) {
  const product = applyOverride(rawProduct);
  const { user, sessionToken } = useAuth();
  const [, navigate] = useLocation();

  const [selectedVariant, setSelectedVariant] = useState(product.variants[0]);
  const [paymentMethod, setPaymentMethod] = useState<"qris" | "usdt">("qris");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [captchaOK, setCaptchaOK] = useState(false);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Compute "best value" — varian dengan harga per "satuan duration" terkecil
  const cheapestPrice = useMemo(
    () => Math.min(...product.variants.map((v) => v.price)),
    [product.variants],
  );
  const mostExpensive = useMemo(
    () => Math.max(...product.variants.map((v) => v.price)),
    [product.variants],
  );

  const tierPct = getTierDiscountPct(user?.role);
  const tierInfo = (user?.role === "reseller" || user?.role === "pro" || user?.role === "elite")
    ? TIERS[user.role]
    : null;
  const tierDiscount = Math.round((selectedVariant.price * tierPct) / 100);
  const finalPriceIDR = selectedVariant.price - tierDiscount;
  const fee = paymentMethod === "qris" ? Math.round(finalPriceIDR * 0.007) : 0; // simulasi fee QRIS 0.7%
  const total = finalPriceIDR + fee;

  const handleConfirm = () => {
    setError("");
    if (!user || !sessionToken) { onClose(); navigate("/login"); return; }

    // Banned check
    const ext = getUserExt(user.id);
    if ((ext as any)?.banned) {
      setError(`Akun kamu dibanned. Alasan: ${(ext as any).banReason || "—"}`);
      pushActivity("order", `Pembelian DITOLAK (banned): ${user.username}`);
      return;
    }

    if (!captchaOK) { setError("Selesaikan captcha verifikasi terlebih dahulu."); return; }

    const check = canCreateOrder(user.id);
    if (!check.ok) { setError(check.reason || "Order ditolak."); return; }

    setSubmitting(true);
    const order = createOrder({
      userId: user.id,
      username: user.username,
      productId: product.id,
      productName: product.title,
      variantId: selectedVariant.id,
      variantLabel: selectedVariant.label,
      variantPrice: selectedVariant.price,
      finalPriceIDR,
      buyerName: user.username,
      paymentMethod,
      status: "pending",
      amountUSDT: paymentMethod === "usdt" ? parseFloat(toUSD(finalPriceIDR)) : undefined,
    });
    onClose();
    navigate(paymentMethod === "qris" ? `/payment/qris/${order.id}` : `/payment/usdt/${order.id}`);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose}
      />

      <div
        className="relative w-full sm:max-w-md max-h-[95vh] flex flex-col
                   bg-gradient-to-b from-[#15151c] to-[#0c0c10]
                   border border-white/10 rounded-t-3xl sm:rounded-3xl overflow-hidden
                   shadow-[0_-20px_60px_rgba(0,0,0,0.6)] animate-in slide-in-from-bottom-4 duration-300"
      >
        {/* Pull handle (mobile) */}
        <div className="sm:hidden absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/15" />

        {/* Header — product hero */}
        <div className="relative px-5 pt-7 sm:pt-5 pb-4 border-b border-white/5 shrink-0">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3 pr-10">
            <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-white/5 border border-white/10 shrink-0">
              {product.imageUrl ? (
                <img src={product.imageUrl} alt={product.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-primary">
                  <Sparkles className="w-6 h-6" />
                </div>
              )}
              <div className="absolute -bottom-px -right-px w-5 h-5 bg-emerald-400 rounded-tl-lg flex items-center justify-center">
                <BadgeCheck className="w-3 h-3 text-black" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] tracking-widest text-muted-foreground uppercase">{product.publisher || "Resmi"}</p>
              <h2 className="text-base font-extrabold leading-tight truncate">{product.title}</h2>
              <p className="text-[11px] text-emerald-400 mt-0.5 inline-flex items-center gap-1">
                <Zap className="w-3 h-3" /> Pengiriman instan setelah pembayaran
              </p>
            </div>
          </div>

          {/* Trust strip */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            {[
              { icon: <ShieldCheck className="w-3.5 h-3.5" />, label: "Garansi 30 Hari" },
              { icon: <Lock className="w-3.5 h-3.5" />,         label: "Pembayaran Aman" },
              { icon: <Sparkles className="w-3.5 h-3.5" />,     label: "Auto-Delivery" },
            ].map((t) => (
              <div key={t.label} className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/[0.03] border border-white/5 text-[10px] font-semibold text-muted-foreground">
                <span className="text-emerald-400">{t.icon}</span>
                <span className="truncate">{t.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {/* Variants */}
          <section>
            <div className="flex items-baseline justify-between mb-3">
              <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">Pilih Paket</p>
              <p className="text-[10px] text-muted-foreground">{product.variants.length} opsi</p>
            </div>

            <div className="space-y-2">
              {product.variants.map((v) => {
                const active = selectedVariant.id === v.id;
                const isCheapest = v.price === cheapestPrice && product.variants.length > 1;
                const isPopular  = v.price === mostExpensive && product.variants.length > 2;
                return (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariant(v)}
                    className={`w-full text-left relative overflow-hidden rounded-2xl border-2 transition-all
                      ${active
                        ? "border-[#aaff00] bg-[#aaff00]/[0.06] shadow-[0_0_0_4px_rgba(170,255,0,0.08)]"
                        : "border-white/8 bg-white/[0.02] hover:border-white/20"}`}
                  >
                    <div className="flex items-center gap-3 px-4 py-3.5">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors
                        ${active ? "border-[#aaff00] bg-[#aaff00]" : "border-muted-foreground/40"}`}>
                        {active && <div className="w-2 h-2 rounded-full bg-black" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold truncate">{v.label}</span>
                          {isCheapest && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
                              HEMAT
                            </span>
                          )}
                          {isPopular && !isCheapest && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0">
                              TERLARIS
                            </span>
                          )}
                        </div>
                        {paymentMethod === "usdt" && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">≈ {formatCurrency(v.price)}</p>
                        )}
                      </div>
                      <div className={`text-right shrink-0 ${active ? "text-[#aaff00]" : "text-foreground"}`}>
                        <p className="text-sm font-extrabold leading-tight tabular-nums">
                          {paymentMethod === "usdt" ? `$${toUSD(v.price)}` : formatCurrency(v.price)}
                        </p>
                        {paymentMethod === "qris" && (
                          <p className="text-[10px] text-muted-foreground tabular-nums">+ fee QRIS</p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Auto-delivery info */}
          <section>
            <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] px-3.5 py-3">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              <p className="text-xs text-emerald-300/90 leading-snug">
                Key akan otomatis muncul di layar setelah pembayaran berhasil dan tersimpan di <span className="font-bold text-foreground">Riwayat Pembelian</span>.
              </p>
            </div>
            {error && (
              <p className="text-xs text-rose-400 mt-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {error}
              </p>
            )}
          </section>

          {/* Payment Method */}
          <section>
            <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-3">Metode Pembayaran</p>
            <div className="grid grid-cols-2 gap-2.5">
              {([
                {
                  id: "qris" as const,
                  title: "QRIS",
                  sub: "GoPay · OVO · DANA · Bank",
                  icon: <QrCode className="w-5 h-5" />,
                  feeLabel: "Fee 0.7%",
                },
                {
                  id: "usdt" as const,
                  title: "Binance Pay",
                  sub: "USDT (TRC20/BEP20)",
                  icon: <Bitcoin className="w-5 h-5" />,
                  feeLabel: "Tanpa Fee",
                },
              ]).map((m) => {
                const active = paymentMethod === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setPaymentMethod(m.id)}
                    className={`relative text-left rounded-2xl border-2 p-3 transition-all overflow-hidden
                      ${active
                        ? "border-[#aaff00] bg-[#aaff00]/[0.08] shadow-[0_0_24px_rgba(170,255,0,0.18)]"
                        : "border-white/8 bg-white/[0.02] hover:border-white/20"}`}
                  >
                    {active && (
                      <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[#aaff00] flex items-center justify-center">
                        <BadgeCheck className="w-3 h-3 text-black" />
                      </span>
                    )}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2
                      ${active ? "bg-black text-[#aaff00]" : "bg-white/5 text-muted-foreground"}`}>
                      {m.icon}
                    </div>
                    <p className="text-sm font-extrabold leading-tight">{m.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{m.sub}</p>
                    <p className={`text-[9.5px] font-bold mt-1.5 ${active ? "text-[#aaff00]" : "text-muted-foreground"}`}>
                      {m.feeLabel}
                    </p>
                  </button>
                );
              })}
            </div>

            {paymentMethod === "usdt" && (
              <div className="mt-2.5 flex items-start gap-2 text-[11px] text-amber-300/90 bg-amber-500/[0.06] border border-amber-500/20 rounded-xl px-3 py-2">
                <Zap className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <p>Bayar via Binance Pay sebesar <span className="font-bold">${toUSD(selectedVariant.price)}</span> — kurs realtime saat checkout.</p>
              </div>
            )}
          </section>

          {/* Captcha */}
          <section>
            <CaptchaInput onValid={setCaptchaOK} label="Verifikasi Sebelum Bayar" />
          </section>
        </div>

        {/* Footer — sticky total */}
        <div className="shrink-0 border-t border-white/5 bg-[#08080b]/80 backdrop-blur-md px-5 pt-3 pb-4 sm:pb-3">
          {/* Price breakdown */}
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-[10px] tracking-widest text-muted-foreground uppercase">Total Bayar</p>
              <p className="text-2xl font-black text-[#aaff00] leading-tight tabular-nums">
                {paymentMethod === "usdt" ? `$${toUSD(total)}` : formatCurrency(total)}
              </p>
              {paymentMethod === "qris" && fee > 0 && (
                <p className="text-[10px] text-muted-foreground tabular-nums">
                  Subtotal {formatCurrency(finalPriceIDR)} + fee {formatCurrency(fee)}
                </p>
              )}
              {tierInfo && tierDiscount > 0 && (
                <p className="text-[10px] text-emerald-400 tabular-nums font-bold">
                  Diskon {tierInfo.label} −{tierInfo.discountPct}% ({formatCurrency(tierDiscount)}) sudah termasuk
                </p>
              )}
            </div>
            <details className="group">
              <summary className="cursor-pointer list-none text-[11px] font-bold text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5">
                Detail <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform" />
              </summary>
            </details>
          </div>

          <button
            onClick={handleConfirm}
            disabled={submitting || !captchaOK}
            className="w-full h-13 py-3.5 bg-gradient-to-r from-[#aaff00] to-[#88dd00] text-black font-black rounded-2xl text-sm tracking-wide
                       transition-all hover:brightness-110 active:scale-[0.98]
                       shadow-[0_0_24px_rgba(170,255,0,0.35)] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <Lock className="w-4 h-4" />
            {submitting ? "Memproses..." : !captchaOK ? "Selesaikan Captcha" : "Bayar Sekarang"}
          </button>

          <p className="text-center text-[10px] text-muted-foreground mt-2.5 leading-snug">
            Dengan melanjutkan kamu setuju dengan <span className="text-foreground/80 font-semibold">Syarat & Ketentuan</span> TECHGEMING.
          </p>
        </div>
      </div>
    </div>
  );
}
