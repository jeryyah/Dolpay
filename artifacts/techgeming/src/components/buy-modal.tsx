import React, { useEffect, useMemo, useState } from "react";
import {
  X, ShieldCheck, Zap, Lock, BadgeCheck, ChevronDown, AlertTriangle,
  QrCode, Bitcoin, Sparkles, Send, ArrowRight,
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
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

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
  const fee = paymentMethod === "qris" ? Math.round(finalPriceIDR * 0.007) : 0;
  const total = finalPriceIDR + fee;

  const handleConfirm = () => {
    setError("");
    if (!user || !sessionToken) { onClose(); navigate("/login"); return; }

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

  const variants = product.variants;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />

      <div
        className="relative w-full sm:max-w-4xl max-h-[95vh] flex flex-col
                   bg-gradient-to-br from-[#0e0a1e] via-[#0a0814] to-[#0d0a1a]
                   border border-violet-500/20 rounded-t-3xl sm:rounded-3xl overflow-hidden
                   shadow-[0_-20px_80px_rgba(139,92,246,0.25)] animate-in slide-in-from-bottom-4 duration-300"
      >
        {/* Pull handle (mobile) */}
        <div className="sm:hidden absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/15 z-10" />

        {/* HEADER — brand + product + warranty */}
        <div className="relative px-5 sm:px-6 pt-7 sm:pt-6 pb-5 border-b border-white/5 shrink-0">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all z-10"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-start justify-between gap-3 pr-10">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 border border-violet-400/30 shrink-0 shadow-[0_0_20px_rgba(168,85,247,0.35)]">
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-violet-300">
                    <Sparkles className="w-7 h-7" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight leading-none">
                  <span className="bg-gradient-to-r from-white via-violet-100 to-fuchsia-300 bg-clip-text text-transparent">
                    {product.title.toUpperCase()}
                  </span>
                </h2>
                <p className="text-[11px] sm:text-xs text-muted-foreground mt-1.5 inline-flex items-center gap-1.5">
                  Instant Delivery Setelah Pembayaran
                  <BadgeCheck className="w-3.5 h-3.5 text-sky-400" />
                </p>
              </div>
            </div>

            {/* 30 Hari Garansi badge */}
            <div className="hidden sm:flex shrink-0 items-center gap-2.5 px-3 py-2 rounded-2xl border border-violet-500/30 bg-violet-500/[0.08]">
              <ShieldCheck className="w-5 h-5 text-violet-300" />
              <div className="text-right leading-none">
                <p className="text-lg font-black text-white">30</p>
                <p className="text-[9px] font-extrabold text-violet-300 tracking-wider">HARI</p>
              </div>
              <p className="text-[10px] font-extrabold text-violet-300 tracking-wider rotate-0">GARANSI</p>
            </div>
          </div>

          {/* Trust strip */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-5">
            {[
              { icon: <ShieldCheck className="w-4 h-4" />, title: "Garansi 30 Hari", sub: "Uang kembali jika bermasalah" },
              { icon: <Lock className="w-4 h-4" />,         title: "Pembayaran Aman", sub: "Enkripsi & proteksi penuh" },
              { icon: <Zap className="w-4 h-4" />,          title: "Auto-Delivery",  sub: "Key langsung dikirim otomatis" },
            ].map((t) => (
              <div key={t.title} className="flex items-start gap-2 px-2.5 py-2 rounded-xl bg-white/[0.025] border border-white/5">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500/25 to-fuchsia-500/15 text-violet-300 flex items-center justify-center shrink-0">
                  {t.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-[11px] font-bold leading-tight truncate">{t.title}</p>
                  <p className="text-[9px] sm:text-[10px] text-muted-foreground leading-snug truncate">{t.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* BODY — two columns on sm+ */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* LEFT: Pilih Paket + auto-delivery */}
          <section className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/25 to-fuchsia-500/15 text-violet-300 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="leading-tight">
                  <p className="text-sm font-extrabold">Pilih Paket</p>
                  <p className="text-[10px] text-muted-foreground">Pilih durasi akses sesuai kebutuhanmu</p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-muted-foreground px-2 py-0.5 rounded-md bg-white/5 border border-white/5 shrink-0">
                {variants.length} OPSI
              </span>
            </div>

            <div className="space-y-2">
              {variants.map((v, idx) => {
                const active = selectedVariant.id === v.id;
                const isCheapest = v.price === cheapestPrice && variants.length > 1;
                const isPopular  = v.price === mostExpensive && variants.length > 2;
                const isBestDeal = active && idx === 0;
                return (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariant(v)}
                    className={`group w-full text-left relative overflow-hidden rounded-2xl border transition-all
                      ${active
                        ? "border-fuchsia-400/50 bg-gradient-to-br from-violet-500/15 via-fuchsia-500/10 to-transparent shadow-[0_0_30px_-5px_rgba(217,70,239,0.5)]"
                        : "border-white/8 bg-white/[0.02] hover:border-violet-400/30 hover:bg-white/[0.04]"}`}
                  >
                    {isBestDeal && (
                      <span className="absolute top-0 right-0 px-3 py-1 text-[9px] font-black tracking-wider text-white bg-gradient-to-l from-fuchsia-500 to-rose-500 rounded-bl-2xl">
                        BEST DEAL
                      </span>
                    )}
                    <div className="flex items-center gap-3 px-4 py-3.5">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors
                        ${active ? "border-fuchsia-400 bg-fuchsia-400" : "border-muted-foreground/40"}`}>
                        {active && <div className="w-2 h-2 rounded-full bg-black" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-bold truncate">{v.label}</span>
                          {isCheapest && !isBestDeal && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
                              HEMAT
                            </span>
                          )}
                          {isPopular && !isCheapest && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0">
                              TERLARIS
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Akses penuh selama {v.label.toLowerCase()}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-extrabold leading-tight tabular-nums text-white">
                          {paymentMethod === "usdt" ? `$${toUSD(v.price)}` : formatCurrency(v.price)}
                        </p>
                        {paymentMethod === "qris" && (
                          <p className="text-[9px] text-muted-foreground tabular-nums">+ Fee QRIS</p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Auto-delivery info */}
            <div className="mt-3 flex items-start gap-2.5 rounded-2xl border border-sky-500/20 bg-sky-500/[0.05] px-3.5 py-3">
              <div className="w-7 h-7 rounded-lg bg-sky-500/15 text-sky-300 flex items-center justify-center shrink-0">
                <Send className="w-3.5 h-3.5" />
              </div>
              <p className="text-xs text-sky-100/85 leading-snug">
                Key akan otomatis muncul di layar setelah pembayaran berhasil dan tersimpan di{" "}
                <span className="font-bold text-sky-300">Riwayat Pembelian</span>.
              </p>
            </div>
          </section>

          {/* RIGHT: Metode Pembayaran + Verifikasi */}
          <section className="space-y-4">
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/25 to-fuchsia-500/15 text-violet-300 flex items-center justify-center">
                  <QrCode className="w-4 h-4" />
                </div>
                <div className="leading-tight">
                  <p className="text-sm font-extrabold">Metode Pembayaran</p>
                  <p className="text-[10px] text-muted-foreground">Pilih metode pembayaran favoritmu</p>
                </div>
              </div>

              <div className="space-y-2.5">
                {([
                  { id: "qris" as const, title: "QRIS", sub: "QR Code · E-Wallet · Bank", icon: <QrCode className="w-7 h-7" />, feeLabel: "Fee 0.7%" },
                  { id: "usdt" as const, title: "BINANCE PAY", sub: "USDT (TRC20/BEP20)", icon: <Bitcoin className="w-7 h-7" />, feeLabel: "Tanpa Fee" },
                ]).map((m) => {
                  const active = paymentMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setPaymentMethod(m.id)}
                      className={`relative w-full text-left rounded-2xl border p-3.5 transition-all overflow-hidden
                        ${active
                          ? "border-fuchsia-400/50 bg-gradient-to-br from-violet-600/25 via-fuchsia-600/15 to-sky-600/15 shadow-[0_0_30px_-5px_rgba(217,70,239,0.5)]"
                          : "border-white/8 bg-white/[0.02] hover:border-violet-400/30"}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0
                          ${active ? "bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white" : "bg-white/5 text-muted-foreground"}`}>
                          {m.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-base font-black leading-tight tracking-tight ${active ? "text-white" : "text-foreground"}`}>{m.title}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{m.sub}</p>
                          <span className={`inline-block mt-1.5 text-[10px] font-extrabold px-2 py-0.5 rounded-md
                            ${active ? "bg-white/15 text-white" : "bg-white/5 text-muted-foreground"}`}>
                            {m.feeLabel}
                          </span>
                        </div>
                        <span className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center
                          ${active ? "border-white bg-white" : "border-muted-foreground/40"}`}>
                          {active && <BadgeCheck className="w-3.5 h-3.5 text-fuchsia-600" />}
                        </span>
                      </div>
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
            </div>

            {/* Captcha card */}
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
              <CaptchaInput onValid={setCaptchaOK} label="Verifikasi Sebelum Bayar" />
            </div>

            {error && (
              <p className="text-xs text-rose-400 flex items-center gap-1.5 px-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {error}
              </p>
            )}
          </section>
        </div>

        {/* FOOTER — Total + CTA */}
        <div className="shrink-0 border-t border-violet-500/15 bg-[#08060f]/95 backdrop-blur-md px-5 sm:px-6 pt-4 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <Send className="w-3.5 h-3.5 text-violet-300" />
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Total Pembayaran</p>
                <button
                  onClick={() => setShowDetail((s) => !s)}
                  className="ml-auto sm:ml-2 text-[11px] font-bold text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
                >
                  Lihat Rincian <ChevronDown className={`w-3 h-3 transition-transform ${showDetail ? "rotate-180" : ""}`} />
                </button>
              </div>
              <p className="text-3xl sm:text-4xl font-black leading-none tabular-nums bg-gradient-to-r from-fuchsia-400 to-violet-300 bg-clip-text text-transparent">
                {paymentMethod === "usdt" ? `$${toUSD(total)}` : formatCurrency(total)}
              </p>
              {paymentMethod === "qris" && fee > 0 && (
                <p className="text-[10px] text-muted-foreground tabular-nums mt-1">
                  Subtotal {formatCurrency(finalPriceIDR)} + Fee {formatCurrency(fee)}
                </p>
              )}
              {showDetail && (
                <div className="mt-2 text-[11px] text-muted-foreground space-y-0.5 tabular-nums">
                  <div className="flex justify-between gap-6"><span>Paket {selectedVariant.label}</span><span>{formatCurrency(selectedVariant.price)}</span></div>
                  {tierInfo && tierDiscount > 0 && (
                    <div className="flex justify-between gap-6 text-emerald-400 font-bold">
                      <span>Diskon {tierInfo.label} −{tierInfo.discountPct}%</span>
                      <span>−{formatCurrency(tierDiscount)}</span>
                    </div>
                  )}
                  {fee > 0 && (
                    <div className="flex justify-between gap-6"><span>Fee QRIS 0.7%</span><span>{formatCurrency(fee)}</span></div>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="inline-flex items-center gap-1 text-[9.5px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">
                  <ShieldCheck className="w-3 h-3" /> Transaksi dilindungi
                </span>
                <span className="inline-flex items-center gap-1 text-[9.5px] font-bold px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-300 border border-sky-500/25">
                  <Zap className="w-3 h-3" /> Aman, cepat & terpercaya
                </span>
              </div>
            </div>

            <button
              onClick={handleConfirm}
              disabled={submitting || !captchaOK}
              className="shrink-0 sm:w-auto w-full h-14 px-6 sm:px-8 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-sky-500
                         text-white font-black rounded-2xl text-sm tracking-wide
                         transition-all hover:brightness-110 active:scale-[0.98]
                         shadow-[0_10px_40px_-5px_rgba(217,70,239,0.5)]
                         disabled:opacity-60 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              {submitting ? "Memproses..." : !captchaOK ? "Selesaikan Captcha" : "Bayar Sekarang"}
              {!submitting && captchaOK && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>

          <p className="text-center text-[10px] text-muted-foreground mt-3 leading-snug">
            <Lock className="w-2.5 h-2.5 inline -mt-0.5 mr-1" />
            Pembayaran aman 100% terenkripsi. Dengan melanjutkan kamu setuju dengan{" "}
            <span className="text-violet-300 font-semibold">Syarat & Ketentuan</span> TECHGEMING.
          </p>
        </div>
      </div>
    </div>
  );
}
