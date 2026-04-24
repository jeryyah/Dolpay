import React, { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle, Clock, ShoppingBag, Copy, RefreshCw, Tag, X as XIcon } from "lucide-react";
import { BackButton } from "@/components/back-button";
import {
  getOrderById, confirmQrisPayment, getPaymentSettings,
  validateCoupon, redeemCoupon, getOrders, saveOrders,
  type Order,
} from "@/lib/storage";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

export default function PaymentQRIS() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [timeLeft, setTimeLeft] = useState(120);
  const [paid, setPaid] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [couponMsg, setCouponMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    const o = getOrderById(id);
    if (!o) { navigate("/"); return; }
    setOrder(o);
    if (o.status === "paid") { setPaid(true); }
  }, [id]);

  const basePrice = order?.variantPrice || 0;
  const discount = order?.discountIDR || 0;
  const totalPay = order?.finalPriceIDR ?? basePrice;

  const applyCoupon = () => {
    if (!order || !user) return;
    const v = validateCoupon(couponInput, user.id, basePrice);
    if (!v.ok) {
      setCouponMsg({ type: "err", text: v.error || "Kupon tidak valid." });
      return;
    }
    const all = getOrders();
    const idx = all.findIndex((o) => o.id === order.id);
    if (idx >= 0) {
      all[idx] = {
        ...all[idx],
        couponCode: v.coupon!.code,
        discountIDR: v.discount!,
        finalPriceIDR: v.finalPrice!,
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
      const { couponCode, discountIDR, finalPriceIDR, ...rest } = all[idx];
      all[idx] = { ...rest, updatedAt: new Date().toISOString() } as Order;
      saveOrders(all);
      setOrder(all[idx]);
      setCouponInput("");
      setCouponMsg(null);
    }
  };

  useEffect(() => {
    if (paid || !order) return;
    const t = setInterval(() => {
      setTimeLeft((s) => {
        if (s <= 1) { clearInterval(t); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [paid, order]);

  const handleConfirm = async () => {
    setConfirming(true);
    await new Promise((r) => setTimeout(r, 1800));
    const updated = confirmQrisPayment(id);
    if (updated) {
      if (updated.couponCode && user) redeemCoupon(updated.couponCode, user.id);
      setOrder(updated);
      setPaid(true);
    }
    setConfirming(false);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const mins = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const secs = String(timeLeft % 60).padStart(2, "0");

  const settings = getPaymentSettings();
  const qrValue = order
    ? `QRIS.PAYMENT|ORDERID:${order.id}|AMOUNT:${totalPay}`
    : "";

  if (!order) return null;

  if (paid && order.key) {
    return (
      <div className="min-h-screen bg-background noise-bg flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-20 h-20 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-10 h-10 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold mb-1">Pembayaran Berhasil!</h1>
          <p className="text-muted-foreground text-sm mb-6">Pesanan kamu sudah dikonfirmasi. Ini key-nya:</p>

          <div className="bg-card border border-border rounded-2xl p-5 mb-5">
            <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-3">License Key</p>
            <div className="flex items-center gap-3 bg-background border border-primary/30 rounded-xl px-4 py-3">
              <code className="font-mono text-primary font-bold text-sm flex-1 break-all">{order.key}</code>
              <button onClick={() => handleCopy(order.key!)} className="text-muted-foreground hover:text-primary transition-colors shrink-0">
                {copied ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-3 text-left">
              <span className="font-bold text-foreground">{order.productName}</span> · {order.variantLabel}
            </p>
          </div>

          <button onClick={() => navigate("/history")} className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-all">
            Lihat Riwayat Pembelian
          </button>
          <button onClick={() => navigate("/")} className="w-full py-3 text-muted-foreground text-sm hover:text-foreground transition-colors mt-2">
            Kembali ke Beranda
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background noise-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-4"><BackButton /></div>
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <ShoppingBag className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-bold">Bayar via QRIS</h1>
          </div>
          <p className="text-sm text-muted-foreground">{order.productName} · {order.variantLabel}</p>
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl shadow-black/30">
          {/* Amount */}
          <div className="bg-primary/5 border-b border-border px-5 py-4">
            {discount > 0 && (
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>Subtotal</span>
                <span className="line-through">{formatCurrency(basePrice)}</span>
              </div>
            )}
            {discount > 0 && (
              <div className="flex items-center justify-between text-xs text-green-400 mb-2">
                <span className="flex items-center gap-1">
                  <Tag className="w-3 h-3" /> Kupon {order.couponCode}
                </span>
                <span>− {formatCurrency(discount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Pembayaran</span>
              <span className="text-2xl font-bold text-primary">{formatCurrency(totalPay)}</span>
            </div>
          </div>

          {/* Coupon */}
          <div className="border-b border-border px-5 py-3.5">
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

          {/* QR Code */}
          <div className="flex flex-col items-center py-6 px-5">
            <div className="bg-white p-4 rounded-2xl shadow-md mb-4">
              {settings.qrisImageBase64 ? (
                <img src={settings.qrisImageBase64} alt="QRIS" className="w-44 h-44 object-contain" />
              ) : (
                <QRCodeSVG value={qrValue} size={180} level="M" />
              )}
            </div>
            <p className="text-xs text-muted-foreground text-center mb-1">Scan QR di atas dengan aplikasi e-wallet / m-banking</p>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">Berlaku:</span>
              <span className={`font-mono font-bold ${timeLeft <= 30 ? "text-destructive animate-pulse" : "text-foreground"}`}>
                {mins}:{secs}
              </span>
            </div>
          </div>

          {/* Order Info */}
          <div className="border-t border-border px-5 py-4 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Order ID</span>
              <div className="flex items-center gap-1.5">
                <code className="font-mono text-xs text-foreground">{order.id}</code>
                <button onClick={() => handleCopy(order.id)} className="text-muted-foreground hover:text-primary">
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Confirm Button */}
          <div className="px-5 pb-5">
            <button
              onClick={handleConfirm}
              disabled={confirming || timeLeft === 0}
              className="w-full py-3.5 bg-[#aaff00] text-black font-bold rounded-xl text-base transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {confirming ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Memverifikasi...</>
              ) : timeLeft === 0 ? (
                "QR Kadaluarsa"
              ) : (
                "✓ Saya Sudah Membayar"
              )}
            </button>
            <button onClick={() => navigate("/")} className="w-full py-2.5 text-center text-sm text-muted-foreground hover:text-foreground transition-colors mt-2">
              Batalkan Pesanan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
