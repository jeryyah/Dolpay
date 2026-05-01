import React, { useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { QRCodeSVG } from "qrcode.react";
import {
  CheckCircle, Clock, ShoppingBag, Copy, RefreshCw, Tag,
  X as XIcon, Download, Upload, FileImage, Key,
} from "lucide-react";
import { BackButton } from "@/components/back-button";
import {
  getOrderById, submitQrisProof, getPaymentSettings,
  validateCoupon, redeemCoupon, getOrders, saveOrders, deleteOrder,
  type Order,
} from "@/lib/storage";
import { useStorageVersion } from "@/lib/use-live-storage";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";

const QR_TIMEOUT_SECONDS = 300; // 5 menit
const MAX_PROOF_BYTES   = 5 * 1024 * 1024; // 5 MB

export default function PaymentQRIS() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [timeLeft, setTimeLeft] = useState(QR_TIMEOUT_SECONDS);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [couponMsg, setCouponMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Bukti transfer yang akan diupload ke admin.
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [proofError, setProofError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Kode unik manual untuk membantu admin mencocokkan pembayaran.
  const [uniqueCode] = useState(() => Math.floor(100 + Math.random() * 900));

  const qrWrapperRef = useRef<HTMLDivElement | null>(null);

  // Re-render setiap kali admin update settings/QRIS — tanpa reload halaman.
  const storageVer = useStorageVersion();
  const settings = React.useMemo(() => getPaymentSettings(), [storageVer]);

  useEffect(() => {
    const o = getOrderById(id);
    if (!o) { navigate("/"); return; }
    setOrder(o);
    if (o.status === "pending_verify" || o.status === "verified" || o.status === "paid") {
      setSubmitted(true);
    }
  }, [id]);

  const basePrice = order?.variantPrice || 0;
  const discount = order?.discountIDR || 0;
  const orderTotal = order?.finalPriceIDR ?? basePrice;
  // Total yang ditampilkan ke pembeli sudah termasuk kode unik.
  const totalPay = orderTotal + uniqueCode;

  // ─── Countdown timer ────────────────────────────────────────────────────
  useEffect(() => {
    if (submitted || !order) return;
    const t = setInterval(() => {
      setTimeLeft((s) => {
        if (s <= 1) { clearInterval(t); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [submitted, order]);

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

  // ─── Proof upload handlers ─────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProofError(null);
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setProofError("File harus berupa gambar (JPG / PNG / WEBP).");
      return;
    }
    if (f.size > MAX_PROOF_BYTES) {
      setProofError("Ukuran maksimal 5MB. Coba kompres screenshot dulu.");
      return;
    }
    setProofFile(f);
    const reader = new FileReader();
    reader.onloadend = () => setPreviewUrl(reader.result as string);
    reader.readAsDataURL(f);
  };

  const clearProof = () => {
    setProofFile(null);
    setPreviewUrl(null);
    setProofError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!proofFile || !previewUrl) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 1200));
    const updated = submitQrisProof(id, previewUrl, proofFile.name);
    if (updated) {
      if (updated.couponCode && user) redeemCoupon(updated.couponCode, user.id);
      setOrder(updated);
      setSubmitted(true);
    }
    setSubmitting(false);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // ─── Download QR (works for static image or fallback SVG QR) ──────────
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
      const src = imgEl?.src || "";
      if (src) window.open(src, "_blank");
    }
  };

  const mins = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const secs = String(timeLeft % 60).padStart(2, "0");

  // QR statis yang di-upload admin di halaman Pengaturan, ATAU fallback SVG
  // QR yang berisi info pesanan (kalau admin belum upload gambar QR-nya).
  const qrFallbackValue = order
    ? `QRIS.PAYMENT|ORDERID:${order.id}|AMOUNT:${totalPay}`
    : "";
  const qrImageSrc = settings.qrisImageBase64 || "";

  if (!order) return null;

  // ─── View 1: Sudah diverifikasi admin → tampilkan license key ─────────
  if ((order.status === "verified" || order.status === "paid") && order.key) {
    return (
      <div className="min-h-screen bg-background noise-bg flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-20 h-20 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-10 h-10 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold mb-1">Pembayaran Berhasil!</h1>
          <p className="text-muted-foreground text-sm mb-6">
            Pesanan kamu sudah dikonfirmasi admin. Ini key-nya:
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

          <button onClick={() => navigate("/my-keys")} className="w-full py-3 bg-gradient-to-r from-amber-400 to-amber-600 text-black font-extrabold rounded-xl hover:brightness-110 transition-all flex items-center justify-center gap-2">
            <Key className="w-4 h-4" /> Ambil Semua Key Saya
          </button>
          <button onClick={() => navigate("/history")} className="w-full mt-2 py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-all">
            Lihat Riwayat Pembelian
          </button>
          <button onClick={() => navigate("/")} className="w-full py-3 text-muted-foreground text-sm hover:text-foreground transition-colors mt-1">
            Kembali ke Beranda
          </button>
        </div>
      </div>
    );
  }

  // ─── View 2: Sudah kirim bukti, menunggu admin verifikasi ─────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-background noise-bg flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-20 h-20 rounded-full bg-yellow-500/15 flex items-center justify-center mx-auto mb-5">
            <Clock className="w-10 h-10 text-yellow-400" />
          </div>
          <h1 className="text-2xl font-bold mb-1">Menunggu Verifikasi</h1>
          <p className="text-muted-foreground text-sm mb-6">
            Bukti transfer kamu sudah dikirim ke admin. Verifikasi biasanya 1×24 jam.
            Key akan muncul otomatis di halaman Riwayat begitu disetujui.
          </p>

          <div className="bg-card border border-border rounded-2xl p-4 mb-5 text-left space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Order ID</span>
              <code className="font-mono font-bold text-xs">{order.id}</code>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Produk</span>
              <span className="font-bold text-right">{order.productName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Bayar</span>
              <span className="font-bold text-primary">{formatCurrency(totalPay)}</span>
            </div>
          </div>

          <button onClick={() => navigate("/history")} className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-all mb-2">
            Pantau Status di Riwayat
          </button>
          <button onClick={() => navigate("/")} className="w-full py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            Kembali ke Beranda
          </button>
        </div>
      </div>
    );
  }

  // ─── View 3: Halaman pembayaran utama (scan QR + upload bukti) ────────
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
          <p className="text-[10px] text-muted-foreground mt-1">
            Mode manual · upload bukti transfer setelah membayar
          </p>
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
            <p className="text-[10px] text-muted-foreground mt-1 text-right">
              Termasuk kode unik <code className="font-mono text-primary">+{uniqueCode}</code>
            </p>
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

            <button
              onClick={handleDownloadQR}
              className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download QR
            </button>

            <p className="text-xs text-muted-foreground text-center mb-1">Scan QR di atas dengan aplikasi e-wallet / m-banking</p>
            <p className="text-[10px] text-muted-foreground text-center mb-2 px-2">
              Pastikan transfer <strong className="text-primary">{formatCurrency(totalPay)}</strong> (termasuk kode unik).
            </p>
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
          </div>

          {/* Upload Bukti Transfer */}
          <div className="border-t border-border px-5 py-4">
            <p className="text-sm font-bold mb-2.5 flex items-center gap-2">
              <FileImage className="w-4 h-4 text-primary" />
              Upload Bukti Transfer
            </p>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            {!previewUrl ? (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-border hover:border-primary/50 rounded-xl py-6 flex flex-col items-center gap-1.5 transition-all group"
              >
                <Upload className="w-7 h-7 text-muted-foreground group-hover:text-primary transition-colors" />
                <p className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                  Tap untuk pilih screenshot transfer
                </p>
                <p className="text-[10px] text-muted-foreground">JPG / PNG / WEBP · max 5MB</p>
              </button>
            ) : (
              <div className="space-y-2">
                <div className="relative rounded-xl overflow-hidden border border-border">
                  <img src={previewUrl} alt="Bukti transfer" className="w-full object-cover max-h-44" />
                  <button
                    onClick={clearProof}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 text-xs font-bold"
                    aria-label="Hapus bukti"
                  >
                    ×
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground truncate">{proofFile?.name}</p>
              </div>
            )}

            {proofError && (
              <p className="text-[11px] text-destructive mt-2">{proofError}</p>
            )}
          </div>

          {/* Submit Button */}
          <div className="px-5 pb-5">
            <button
              onClick={handleSubmit}
              disabled={submitting || timeLeft === 0 || !proofFile}
              className="w-full py-3.5 bg-[#aaff00] text-black font-bold rounded-xl text-base transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Mengirim...</>
              ) : timeLeft === 0 ? (
                "QR Kadaluarsa"
              ) : !proofFile ? (
                "Upload Bukti Dulu"
              ) : (
                "✓ Kirim Bukti & Konfirmasi"
              )}
            </button>
            <button
              onClick={() => {
                // Hapus order pending agar riwayat ikut hilang otomatis.
                if (order?.id) deleteOrder(order.id);
                navigate("/");
              }}
              className="w-full py-2.5 text-center text-sm text-muted-foreground hover:text-foreground transition-colors mt-2"
            >
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
    img.onerror = () => { URL.revokeObjectURL(svgUrl); reject(new Error("svg img load failed")); };
    img.src = svgUrl;
  });
}

function triggerDownload(url: string, filename: string, revoke: boolean) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  if (revoke) setTimeout(() => URL.revokeObjectURL(url), 5000);
}
