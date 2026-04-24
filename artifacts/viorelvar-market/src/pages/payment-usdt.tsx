import React, { useEffect, useState, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { QRCodeSVG } from "qrcode.react";
import { Upload, CheckCircle, Clock, Copy, FileImage, Info, Tag, X as XIcon } from "lucide-react";
import { BackButton } from "@/components/back-button";
import {
  getOrderById, submitUsdtProof, getPaymentSettings,
  validateCoupon, redeemCoupon, getOrders, saveOrders,
  type Order,
} from "@/lib/storage";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

const IDR_TO_USD_RATE = 16200;

export default function PaymentBinance() {
  const { user } = useAuth();
  const settings = getPaymentSettings();
  const BINANCE_ID = settings.binancePayId || "478829361";
  const BINANCE_QR_DATA = `binance://pay?binanceId=${BINANCE_ID}`;
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [order, setOrder] = useState<Order | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [tab, setTab] = useState<"qris" | "id">("qris");
  const [couponInput, setCouponInput] = useState("");
  const [couponMsg, setCouponMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const basePrice = order?.variantPrice || 0;
  const discount = order?.discountIDR || 0;
  const totalPayIDR = order?.finalPriceIDR ?? basePrice;
  const displayUSDT = order?.amountUSDT ?? 0;

  const applyCoupon = () => {
    if (!order || !user) return;
    const v = validateCoupon(couponInput, user.id, basePrice);
    if (!v.ok) { setCouponMsg({ type: "err", text: v.error || "Kupon tidak valid." }); return; }
    const all = getOrders();
    const idx = all.findIndex((o) => o.id === order.id);
    if (idx >= 0) {
      const newUsdt = parseFloat((v.finalPrice! / IDR_TO_USD_RATE).toFixed(2));
      all[idx] = {
        ...all[idx],
        couponCode: v.coupon!.code,
        discountIDR: v.discount!,
        finalPriceIDR: v.finalPrice!,
        amountUSDT: newUsdt,
        updatedAt: new Date().toISOString(),
      };
      saveOrders(all);
      setOrder(all[idx]);
      setCouponMsg({ type: "ok", text: `Kupon ${v.coupon!.code} terpakai. Hemat ${formatCurrency(v.discount!)}.` });
    }
  };

  const removeCoupon = () => {
    if (!order) return;
    const all = getOrders();
    const idx = all.findIndex((o) => o.id === order.id);
    if (idx >= 0) {
      const restoreUsdt = parseFloat((basePrice / IDR_TO_USD_RATE).toFixed(2));
      const { couponCode, discountIDR, finalPriceIDR, ...rest } = all[idx];
      all[idx] = { ...rest, amountUSDT: restoreUsdt, updatedAt: new Date().toISOString() } as Order;
      saveOrders(all);
      setOrder(all[idx]);
      setCouponInput("");
      setCouponMsg(null);
    }
  };

  useEffect(() => {
    const o = getOrderById(id);
    if (!o) { navigate("/"); return; }
    setOrder(o);
    if (o.status === "pending_verify" || o.status === "verified") {
      setSubmitted(true);
    }
  }, [id]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setProofFile(f);
    const reader = new FileReader();
    reader.onloadend = () => setPreviewUrl(reader.result as string);
    reader.readAsDataURL(f);
  };

  const handleSubmit = async () => {
    if (!proofFile || !previewUrl) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 1200));
    const updated = submitUsdtProof(id, previewUrl, proofFile.name);
    if (updated) {
      if (updated.couponCode && user) redeemCoupon(updated.couponCode, user.id);
      setOrder(updated);
      setSubmitted(true);
    }
    setSubmitting(false);
  };

  const handleCopy = (text: string, type: "id") => {
    navigator.clipboard.writeText(text);
    if (type === "id") { setCopiedId(true); setTimeout(() => setCopiedId(false), 1500); }
  };

  if (!order) return null;

  if (order.status === "verified" && order.key) {
    return (
      <div className="min-h-screen bg-background noise-bg flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-20 h-20 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-10 h-10 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold mb-1">Terverifikasi!</h1>
          <p className="text-muted-foreground text-sm mb-6">Pembayaran kamu sudah dikonfirmasi admin:</p>
          <div className="bg-card border border-border rounded-2xl p-5 mb-5">
            <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-3">License Key</p>
            <div className="flex items-center gap-3 bg-background border border-primary/30 rounded-xl px-4 py-3">
              <code className="font-mono text-primary font-bold text-sm flex-1 break-all">{order.key}</code>
              <button onClick={() => navigator.clipboard.writeText(order.key!)} className="text-muted-foreground hover:text-primary">
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
          <button onClick={() => navigate("/history")} className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-all">
            Lihat Riwayat
          </button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background noise-bg flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-20 h-20 rounded-full bg-yellow-500/15 flex items-center justify-center mx-auto mb-5">
            <Clock className="w-10 h-10 text-yellow-400" />
          </div>
          <h1 className="text-2xl font-bold mb-1">Menunggu Verifikasi</h1>
          <p className="text-muted-foreground text-sm mb-6">Bukti pembayaran sudah dikirim. Admin akan memverifikasi dalam 1×24 jam.</p>
          <div className="bg-card border border-border rounded-2xl p-4 mb-5 text-left space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Order ID</span>
              <code className="font-mono font-bold text-xs">{order.id}</code>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Produk</span>
              <span className="font-bold">{order.productName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Jumlah</span>
              <span className="font-bold text-primary">${order.amountUSDT} USDT</span>
            </div>
          </div>
          <button onClick={() => navigate("/history")} className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-all mb-2">
            Pantau Status di History
          </button>
          <button onClick={() => navigate("/")} className="w-full py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            Kembali ke Beranda
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background noise-bg p-4 pb-10">
      <div className="max-w-sm mx-auto pt-6">
        <div className="mb-4"><BackButton /></div>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-[#F0B90B]/10 border border-[#F0B90B]/30 text-[#F0B90B] px-3 py-1 rounded-full text-xs font-bold mb-3">
            <img src="https://upload.wikimedia.org/wikipedia/commons/5/57/Binance_Logo.png" alt="Binance" className="w-4 h-4 object-contain" onError={(e) => (e.currentTarget.style.display = "none")} />
            Binance Pay
          </div>
          <h1 className="text-xl font-bold mb-1">Bayar via Binance</h1>
          <p className="text-sm text-muted-foreground">{order.productName} · {order.variantLabel}</p>
          {discount > 0 && (
            <p className="text-xs text-green-400 mt-1.5 flex items-center justify-center gap-1">
              <Tag className="w-3 h-3" /> Kupon {order.couponCode} · hemat {formatCurrency(discount)}
            </p>
          )}
          <div className="mt-2 inline-block bg-primary/10 border border-primary/20 rounded-full px-4 py-1">
            <span className="text-primary font-bold">${displayUSDT} USDT</span>
            <span className="text-muted-foreground text-xs ml-2">≈ {formatCurrency(totalPayIDR)}</span>
          </div>
        </div>

        {/* Coupon */}
        <div className="bg-card border border-border rounded-2xl p-4 mb-4">
          {order.couponCode ? (
            <div className="flex items-center justify-between gap-2 bg-green-500/10 border border-green-500/30 rounded-xl px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <Tag className="w-3.5 h-3.5 text-green-400 shrink-0" />
                <code className="font-mono text-xs font-bold text-green-400 truncate">{order.couponCode}</code>
                <span className="text-[11px] text-muted-foreground">−{formatCurrency(discount)}</span>
              </div>
              <button onClick={removeCoupon} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted shrink-0">
                <XIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <>
              <label className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase mb-1.5 block flex items-center gap-1">
                <Tag className="w-3 h-3" /> Punya Kupon?
              </label>
              <div className="flex gap-2">
                <input
                  value={couponInput}
                  onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponMsg(null); }}
                  placeholder="MASUKKAN KODE"
                  className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-xs font-mono uppercase focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={applyCoupon}
                  disabled={!couponInput.trim()}
                  className="px-4 py-2 bg-primary/15 border border-primary/30 text-primary text-xs font-bold rounded-xl hover:bg-primary/25 transition-all disabled:opacity-40"
                >
                  Pakai
                </button>
              </div>
              {couponMsg && (
                <p className={`text-[11px] mt-1.5 ${couponMsg.type === "ok" ? "text-green-400" : "text-destructive"}`}>
                  {couponMsg.text}
                </p>
              )}
            </>
          )}
        </div>

        {/* Tab Selector */}
        <div className="flex rounded-xl bg-card border border-border overflow-hidden mb-4">
          <button
            onClick={() => setTab("qris")}
            className={`flex-1 py-2.5 text-sm font-bold transition-all ${tab === "qris" ? "bg-[#aaff00] text-black" : "text-muted-foreground hover:text-foreground"}`}
          >
            QRIS Binance
          </button>
          <button
            onClick={() => setTab("id")}
            className={`flex-1 py-2.5 text-sm font-bold transition-all ${tab === "id" ? "bg-[#aaff00] text-black" : "text-muted-foreground hover:text-foreground"}`}
          >
            Binance ID
          </button>
        </div>

        {/* QRIS Tab */}
        {tab === "qris" && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl shadow-black/30 mb-4">
            <div className="bg-[#F0B90B]/8 border-b border-[#F0B90B]/20 px-5 py-3 flex items-start gap-2">
              <Info className="w-4 h-4 text-[#F0B90B] shrink-0 mt-0.5" />
              <p className="text-xs text-[#F0B90B]/90">Buka aplikasi Binance → Pay → Scan QR untuk membayar QRIS di bawah.</p>
            </div>
            <div className="p-5 flex flex-col items-center gap-4">
              <div className="bg-white p-3 rounded-2xl shadow-lg">
                {settings.qrisImageBase64 ? (
                  <img src={settings.qrisImageBase64} alt="QRIS" className="w-40 h-40 object-contain" />
                ) : settings.binanceQrBase64 ? (
                  <img src={settings.binanceQrBase64} alt="Binance QR" className="w-40 h-40 object-contain" />
                ) : (
                  <QRCodeSVG value={BINANCE_QR_DATA} size={160} level="M" />
                )}
              </div>
              <p className="text-xs text-muted-foreground text-center px-4">
                Scan dengan <span className="font-bold text-foreground">Binance App</span>
              </p>
            </div>
          </div>
        )}

        {/* Binance ID Tab */}
        {tab === "id" && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl shadow-black/30 mb-4">
            <div className="bg-[#F0B90B]/8 border-b border-[#F0B90B]/20 px-5 py-3 flex items-start gap-2">
              <Info className="w-4 h-4 text-[#F0B90B] shrink-0 mt-0.5" />
              <p className="text-xs text-[#F0B90B]/90">Buka Binance → Pay → Send → masukkan ID di bawah. Kirim USDT sejumlah yang tertera.</p>
            </div>
            <div className="p-5 flex flex-col items-center gap-4">
              <div className="bg-white p-4 rounded-2xl shadow-lg">
                <QRCodeSVG value={`binance://pay?binanceId=${BINANCE_ID}`} size={160} level="M" />
              </div>
              <div className="w-full">
                <p className="text-xs text-muted-foreground mb-1.5 font-semibold">Binance ID</p>
                <div className="flex items-center gap-2 bg-background border border-border rounded-xl px-4 py-3">
                  <code className="font-mono text-lg font-bold flex-1 tracking-widest text-foreground">{BINANCE_ID}</code>
                  <button onClick={() => handleCopy(BINANCE_ID, "id")} className="text-muted-foreground hover:text-primary shrink-0">
                    {copiedId ? <CheckCircle className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div className="w-full bg-background border border-border rounded-xl px-4 py-3 flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Kirim tepat</span>
                <span className="font-bold text-primary text-lg">${order.amountUSDT} USDT</span>
              </div>
            </div>
          </div>
        )}

        {/* Upload Proof */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-sm font-bold mb-3 flex items-center gap-2">
            <FileImage className="w-4 h-4 text-primary" />
            Upload Bukti Pembayaran
          </p>

          <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

          {!previewUrl ? (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-border hover:border-primary/50 rounded-xl py-8 flex flex-col items-center gap-2 transition-all group"
            >
              <Upload className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
              <p className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">Tap untuk pilih foto / screenshot</p>
              <p className="text-xs text-muted-foreground">JPG, PNG, WEBP (max 5MB)</p>
            </button>
          ) : (
            <div className="space-y-3">
              <div className="relative rounded-xl overflow-hidden border border-border">
                <img src={previewUrl} alt="Bukti transfer" className="w-full object-cover max-h-48" />
                <button
                  onClick={() => { setProofFile(null); setPreviewUrl(null); }}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 text-xs font-bold"
                >
                  ×
                </button>
              </div>
              <p className="text-xs text-muted-foreground">{proofFile?.name}</p>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!proofFile || submitting}
            className="mt-4 w-full py-3.5 bg-[#aaff00] text-black font-bold rounded-xl text-base transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? "Mengirim..." : "Kirim Bukti Pembayaran"}
          </button>
        </div>

      </div>
    </div>
  );
}
