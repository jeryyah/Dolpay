import React, { useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { QRCodeSVG } from "qrcode.react";
import {
  CheckCircle, Clock, ShoppingBag, Copy, RefreshCw, Tag,
  X as XIcon, Download, AlertCircle,
} from "lucide-react";
import { BackButton } from "@/components/back-button";
import {
  getOrderById, confirmQrisPayment, getPaymentSettings,
  validateCoupon, redeemCoupon, getOrders, saveOrders,
  createDeposit, getDepositStatus,
  type Order, type DepositCreateResponse,
} from "@/lib/storage";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

const QR_TIMEOUT_SECONDS = 300; // 5 menit

export default function PaymentQRIS() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [timeLeft, setTimeLeft] = useState(QR_TIMEOUT_SECONDS);
  const [paid, setPaid] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [couponMsg, setCouponMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Gateway-mode state
  const [deposit, setDeposit] = useState<DepositCreateResponse | null>(null);
  const [gatewayLoading, setGatewayLoading] = useState(false);
  const [gatewayError, setGatewayError] = useState<string | null>(null);
  const [autoVerifying, setAutoVerifying] = useState(false);
  const [forceStatic, setForceStatic] = useState(false);

  const qrWrapperRef = useRef<HTMLDivElement | null>(null);

  const settings = getPaymentSettings();
  const gatewayMode =
    !forceStatic &&
    !!(settings.gatewayEnabled && settings.gatewayApiKey && settings.gatewayBaseUrl);

  useEffect(() => {
    const o = getOrderById(id);
    if (!o) { navigate("/"); return; }
    setOrder(o);
    if (o.status === "paid") { setPaid(true); }
  }, [id]);

  const basePrice = order?.variantPrice || 0;
  const discount = order?.discountIDR || 0;
  const orderTotal = order?.finalPriceIDR ?? basePrice;
  // When gateway is on, show the gateway's totalAmount (which includes uniqueCode).
  const totalPay = gatewayMode && deposit ? deposit.totalAmount : orderTotal;

  // ─── Gateway: create deposit when order + gateway settings are ready ────
  useEffect(() => {
    if (!order || paid || !gatewayMode || deposit || gatewayLoading) return;
    let cancelled = false;
    (async () => {
      setGatewayLoading(true);
      setGatewayError(null);
      try {
        const dep = await createDeposit(orderTotal, "qris");
        if (cancelled) return;
        setDeposit(dep);
        // Compute remaining seconds from gateway expiredAt
        const expiresMs = new Date(dep.expiredAt).getTime();
        const remaining = Math.max(0, Math.floor((expiresMs - Date.now()) / 1000));
        setTimeLeft(remaining > 0 ? remaining : QR_TIMEOUT_SECONDS);
      } catch (e: any) {
        if (cancelled) return;
        setGatewayError(
          e?.message?.includes("Gateway")
            ? `Gateway menolak permintaan (${e.message}). Cek API Key & Base URL di Admin → Pembayaran.`
            : "Tidak bisa terhubung ke gateway. Cek koneksi atau setting Admin → Pembayaran."
        );
      } finally {
        if (!cancelled) setGatewayLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [order, paid, gatewayMode, deposit, gatewayLoading, orderTotal]);

  // ─── Gateway: poll deposit status every 4 seconds ──────────────────────
  useEffect(() => {
    if (!gatewayMode || !deposit || paid || timeLeft === 0) return;
    let stopped = false;
    const tick = async () => {
      try {
        const s = await getDepositStatus(deposit.depositId);
        if (stopped) return;
        if (s.status === "success" || s.status === "already") {
          setAutoVerifying(true);
          const updated = confirmQrisPayment(id);
          if (updated) {
            if (updated.couponCode && user) redeemCoupon(updated.couponCode, user.id);
            setOrder(updated);
            setPaid(true);
          }
        }
      } catch {
        // Silent fail; user can still hit "Saya Sudah Membayar" manually.
      }
    };
    const intv = setInterval(tick, 4000);
    return () => { stopped = true; clearInterval(intv); };
  }, [gatewayMode, deposit, paid, timeLeft, id, user]);

  // ─── Countdown timer ────────────────────────────────────────────────────
  useEffect(() => {
    if (paid || !order) return;
    if (gatewayMode && !deposit) return; // wait for deposit to load before counting
    const t = setInterval(() => {
      setTimeLeft((s) => {
        if (s <= 1) { clearInterval(t); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [paid, order, gatewayMode, deposit]);

  // ─── Coupon handlers ────────────────────────────────────────────────────
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

  const handleConfirm = async () => {
    setConfirming(true);
    await new Promise((r) => setTimeout(r, 1500));
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

  // ─── Download QR (works for static image, gateway image, or SVG QR) ────
  const handleDownloadQR = async () => {
    if (!qrWrapperRef.current || !order) return;
    const filename = `QR-${order.id}.png`;

    const imgEl = qrWrapperRef.current.querySelector("img") as HTMLImageElement | null;
    const svgEl = qrWrapperRef.current.querySelector("svg") as SVGSVGElement | null;

    try {
      if (imgEl && imgEl.src) {
        await downloadImageAsPng(imgEl.src, filename);
        return;
      }
      if (svgEl) {
        await downloadSvgAsPng(svgEl, filename);
        return;
      }
    } catch {
      // Fallback: open in new tab so user can long-press / right-click save
      const src = imgEl?.src || "";
      if (src) window.open(src, "_blank");
    }
  };

  const mins = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const secs = String(timeLeft % 60).padStart(2, "0");

  // Prefer the raw EMV/QRIS payload from the gateway — when present, we render
  // it locally as an SVG QR which is always scannable. Falls back to a synthetic
  // payload for the local-simulation mode.
  const qrFallbackValue = order && deposit?.qrString
    ? deposit.qrString
    : order
      ? `QRIS.PAYMENT|ORDERID:${order.id}|AMOUNT:${orderTotal}`
      : "";

  // Choose which QR image source to render.
  //  1. If gateway returned a real qrString → render SVG locally (most reliable).
  //  2. If gateway returned only a remote qrImage URL → use that image.
  //  3. Admin-uploaded static QRIS image (settings.qrisImageBase64).
  //  4. Generated SVG QR (fallback) using qrFallbackValue.
  const useLocalSvg = gatewayMode && !!deposit?.qrString;
  const qrImageSrc =
    useLocalSvg ? "" :
    (gatewayMode && deposit?.qrImage) ? deposit.qrImage :
    settings.qrisImageBase64 ? settings.qrisImageBase64 :
    "";

  if (!order) return null;

  if (paid && order.key) {
    return (
      <div className="min-h-screen bg-background noise-bg flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-20 h-20 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-10 h-10 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold mb-1">Pembayaran Berhasil!</h1>
          <p className="text-muted-foreground text-sm mb-6">
            {autoVerifying
              ? "Pembayaran terdeteksi otomatis oleh gateway. Ini key-nya:"
              : "Pesanan kamu sudah dikonfirmasi. Ini key-nya:"}
          </p>

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
          {gatewayMode && (
            <p className="text-[10px] text-primary mt-1 inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Gateway aktif · status diverifikasi otomatis
            </p>
          )}
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
            {gatewayMode && deposit && deposit.uniqueCode > 0 && (
              <p className="text-[10px] text-muted-foreground mt-1 text-right">
                Termasuk kode unik <code className="font-mono text-primary">+{deposit.uniqueCode}</code>
              </p>
            )}
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
            {gatewayLoading ? (
              <div className="bg-white/5 border border-border w-52 h-52 rounded-2xl flex flex-col items-center justify-center mb-4">
                <RefreshCw className="w-7 h-7 text-primary animate-spin mb-2" />
                <p className="text-xs text-muted-foreground">Membuat QR dari gateway...</p>
              </div>
            ) : gatewayError ? (
              <div className="w-full bg-destructive/10 border border-destructive/30 rounded-2xl p-4 mb-4 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-destructive mb-0.5">Gateway error</p>
                  <p className="text-[11px] text-muted-foreground break-words">{gatewayError}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      onClick={() => { setGatewayError(null); setDeposit(null); }}
                      className="text-[11px] font-bold text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" /> Coba lagi
                    </button>
                    <button
                      onClick={() => {
                        setGatewayError(null);
                        setDeposit(null);
                        setForceStatic(true);
                        setTimeLeft(QR_TIMEOUT_SECONDS);
                      }}
                      className="text-[11px] font-bold text-foreground hover:underline"
                    >
                      Pakai QR statis &rarr;
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div ref={qrWrapperRef} className="bg-white p-4 rounded-2xl shadow-md mb-4">
                {qrImageSrc ? (
                  <img
                    src={qrImageSrc}
                    alt="QRIS"
                    crossOrigin="anonymous"
                    className="w-44 h-44 object-contain"
                  />
                ) : (
                  <QRCodeSVG value={qrFallbackValue} size={180} level="M" />
                )}
              </div>
            )}

            {!gatewayError && (
              <button
                onClick={handleDownloadQR}
                className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download QR
              </button>
            )}

            <p className="text-xs text-muted-foreground text-center mb-1">Scan QR di atas dengan aplikasi e-wallet / m-banking</p>
            <div className="flex items-center gap-1.5 text-xs">
              <Clock className="w-3 h-3 text-muted-foreground" />
              <span className="text-muted-foreground">Berlaku:</span>
              <span className={`font-mono font-bold ${timeLeft <= 60 ? "text-destructive animate-pulse" : "text-foreground"}`}>
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
            {gatewayMode && deposit && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Deposit ID</span>
                <code className="font-mono text-xs text-foreground">{deposit.depositId}</code>
              </div>
            )}
          </div>

          {/* Confirm Button */}
          <div className="px-5 pb-5">
            <button
              onClick={handleConfirm}
              disabled={confirming || timeLeft === 0 || gatewayLoading || autoVerifying}
              className="w-full py-3.5 bg-[#aaff00] text-black font-bold rounded-xl text-base transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {confirming || autoVerifying ? (
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

// ───────────────────────── helpers ─────────────────────────

async function downloadImageAsPng(src: string, filename: string): Promise<void> {
  // Try canvas conversion first (works for same-origin / data URLs / CORS-enabled)
  await new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const size = Math.max(img.naturalWidth, img.naturalHeight, 512);
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("no ctx")); return; }
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, size, size);
        const ratio = Math.min(size / img.naturalWidth, size / img.naturalHeight);
        const w = img.naturalWidth * ratio;
        const h = img.naturalHeight * ratio;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error("no blob")); return; }
          triggerDownload(URL.createObjectURL(blob), filename, true);
          resolve();
        }, "image/png");
      } catch (e) { reject(e); }
    };
    img.onerror = () => reject(new Error("img load failed"));
    img.src = src;
  }).catch(() => {
    // Fallback: direct anchor download (skips PNG conversion)
    triggerDownload(src, filename, false);
  });
}

async function downloadSvgAsPng(svg: SVGSVGElement, filename: string): Promise<void> {
  const svgStr = new XMLSerializer().serializeToString(svg);
  const svgBlob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);
  await new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const size = 512;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("no ctx")); return; }
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, 16, 16, size - 32, size - 32);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(svgUrl);
          if (!blob) { reject(new Error("no blob")); return; }
          triggerDownload(URL.createObjectURL(blob), filename, true);
          resolve();
        }, "image/png");
      } catch (e) { reject(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(svgUrl); reject(new Error("svg→img failed")); };
    img.src = svgUrl;
  });
}

function triggerDownload(href: string, filename: string, revoke: boolean) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (revoke) setTimeout(() => URL.revokeObjectURL(href), 1500);
}
