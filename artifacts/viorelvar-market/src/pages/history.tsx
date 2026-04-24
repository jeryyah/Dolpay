import React, { useState, useEffect } from "react";
import { Link } from "wouter";
import { Navbar, Footer } from "@/components/layout/navbar";
import { HelpBar } from "@/components/help-bar";
import { useAuth } from "@/lib/auth-context";
import {
  getUserOrders, getOrders, type Order,
  warrantyInfo, claimWarranty, replaceKey, backupKeyToEmail,
  verifyUserPin,
} from "@/lib/storage";
import { formatCurrency } from "@/lib/utils";
import {
  ShoppingBag, Clock, CheckCircle, XCircle, Copy, LogIn, RefreshCw, Users, KeyRound,
  Shield, RotateCcw, Mail, Eye, EyeOff, Lock, AlertTriangle, Hourglass, Infinity as InfinityIcon,
} from "lucide-react";

const STATUS_CONFIG: Record<Order["status"], { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "Menunggu Bayar", color: "text-yellow-400", icon: <Clock className="w-4 h-4" /> },
  paid: { label: "Lunas", color: "text-green-400", icon: <CheckCircle className="w-4 h-4" /> },
  pending_verify: { label: "Menunggu Verifikasi", color: "text-blue-400", icon: <Clock className="w-4 h-4" /> },
  verified: { label: "Terverifikasi", color: "text-green-400", icon: <CheckCircle className="w-4 h-4" /> },
  cancelled: { label: "Dibatalkan", color: "text-destructive", icon: <XCircle className="w-4 h-4" /> },
};

/**
 * Real-time countdown untuk masa aktif key (langganan).
 * Jika `expiresAt` undefined dan `durationMs === 0` → Lifetime.
 * Jika `expiresAt` ada → tampilkan d/h/m/s mundur, update tiap detik.
 */
function KeyCountdown({ order }: { order: Order }) {
  const [now, setNow] = useState(Date.now());
  const isLifetime = order.durationMs === 0 && order.expiresAt === undefined;
  const hasExpiry = typeof order.expiresAt === "number";

  useEffect(() => {
    if (!hasExpiry) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [hasExpiry]);

  // Bukan produk berdurasi → jangan render apa-apa
  if (!isLifetime && !hasExpiry) return null;

  if (isLifetime) {
    return (
      <div className="mt-3 rounded-xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/10 to-purple-500/5 p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold flex items-center gap-1.5 text-fuchsia-300">
            <InfinityIcon className="w-3.5 h-3.5" /> Masa Aktif
          </p>
          <span className="text-[10px] font-bold text-fuchsia-300 px-2 py-0.5 rounded-full border border-fuchsia-500/40 bg-fuchsia-500/10">
            LIFETIME
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">Key ini berlaku selamanya. Tidak ada masa kadaluarsa.</p>
      </div>
    );
  }

  const total = (order.expiresAt as number) - (order.activatedAt as number);
  const remaining = Math.max(0, (order.expiresAt as number) - now);
  const expired = remaining === 0;
  const pct = Math.max(0, Math.min(100, (remaining / total) * 100));

  const dd = Math.floor(remaining / 86_400_000);
  const hh = Math.floor((remaining % 86_400_000) / 3_600_000);
  const mm = Math.floor((remaining % 3_600_000) / 60_000);
  const ss = Math.floor((remaining % 60_000) / 1000);

  // Warna sesuai sisa waktu
  const tone =
    expired ? "destructive" :
    remaining < 24 * 3_600_000 ? "amber" :
    remaining < 3 * 86_400_000 ? "yellow" : "green";
  const toneCls = {
    destructive: { ring: "border-destructive/40", bar: "from-destructive to-rose-500", text: "text-destructive", chip: "bg-destructive/15 border-destructive/40 text-destructive" },
    amber:       { ring: "border-amber-500/40",  bar: "from-amber-500 to-orange-500", text: "text-amber-400",   chip: "bg-amber-500/15 border-amber-500/40 text-amber-400" },
    yellow:      { ring: "border-yellow-500/40", bar: "from-yellow-500 to-amber-400", text: "text-yellow-400",  chip: "bg-yellow-500/15 border-yellow-500/40 text-yellow-400" },
    green:       { ring: "border-emerald-500/30",bar: "from-emerald-500 to-green-400",text: "text-emerald-400", chip: "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" },
  }[tone];

  const expDate = new Date(order.expiresAt as number);

  return (
    <div className={`mt-3 rounded-xl border ${toneCls.ring} bg-card/60 p-3`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold flex items-center gap-1.5">
          <Hourglass className={`w-3.5 h-3.5 ${toneCls.text}`} /> Masa Aktif Key
        </p>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${toneCls.chip}`}>
          {expired ? "EXPIRED" : "AKTIF"}
        </span>
      </div>

      {expired ? (
        <p className="text-xs text-destructive font-bold flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5" /> Key sudah habis sejak {expDate.toLocaleString("id-ID")}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { v: dd, l: "HARI" },
              { v: hh, l: "JAM" },
              { v: mm, l: "MENIT" },
              { v: ss, l: "DETIK" },
            ].map((c, i) => (
              <div key={i} className="rounded-lg bg-background border border-border/60 py-1.5 text-center">
                <p className={`text-base font-extrabold tabular-nums ${toneCls.text}`}>{String(c.v).padStart(2, "0")}</p>
                <p className="text-[8px] text-muted-foreground tracking-widest">{c.l}</p>
              </div>
            ))}
          </div>
          <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className={`h-full bg-gradient-to-r ${toneCls.bar} transition-all`} style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">
            Kadaluarsa: <span className="text-foreground font-bold">{expDate.toLocaleString("id-ID")}</span>
          </p>
        </>
      )}
    </div>
  );
}

function OrderCard({ order, onMutate }: { order: Order; onMutate: () => void }) {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const cfg = STATUS_CONFIG[order.status];

  // PIN gate state
  const hasPin = !!user?.pin;
  const [unlocked, setUnlocked] = useState(!hasPin);
  const [pinInput, setPinInput] = useState("");
  const [pinErr, setPinErr] = useState<string | null>(null);

  // Replace key UI state
  const [busy, setBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [showBackup, setShowBackup] = useState(false);
  const [backupEmail, setBackupEmail] = useState(user?.email || "");

  // sync if user updates pin/email elsewhere
  useEffect(() => { setUnlocked(!user?.pin); setBackupEmail(user?.email || ""); }, [user?.id, user?.pin, user?.email]);

  const isMine = order.userId === user?.id;
  const w = warrantyInfo(order);
  const canReplace = !order.replacedAt && w.active && order.key;
  const showServiceTools = isMine && (order.status === "paid" || order.status === "verified") && order.key;

  const copyKey = () => {
    if (!order.key) return;
    navigator.clipboard.writeText(order.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const tryUnlock = () => {
    if (!user) return;
    if (verifyUserPin(user.id, pinInput)) {
      setUnlocked(true); setPinErr(null); setPinInput("");
    } else {
      setPinErr("PIN salah."); setPinInput("");
    }
  };

  const flash = (kind: "ok" | "err", text: string) => {
    setActionMsg({ kind, text });
    setTimeout(() => setActionMsg(null), 2500);
  };

  const onClaimWarranty = () => {
    if (!confirm("Klaim garansi untuk order ini? Admin akan dihubungi otomatis.")) return;
    setBusy(true);
    const r = claimWarranty(order.id);
    setBusy(false);
    if (r.ok) { flash("ok", "Klaim garansi tercatat. Admin akan menindaklanjuti."); onMutate(); }
    else flash("err", r.error || "Gagal klaim.");
  };

  const onReplaceKey = () => {
    if (!confirm("Ganti key dengan key baru dari stok? Hanya bisa 1× selama garansi.")) return;
    setBusy(true);
    const r = replaceKey(order.id);
    setBusy(false);
    if (r.ok) { flash("ok", "Key berhasil diganti dengan key baru."); onMutate(); }
    else flash("err", r.error || "Gagal mengganti key.");
  };

  const onSendBackup = () => {
    setBusy(true);
    const r = backupKeyToEmail(order.id, backupEmail);
    setBusy(false);
    if (r.ok) { flash("ok", `Key dikirim ke ${backupEmail}.`); setShowBackup(false); onMutate(); }
    else flash("err", r.error || "Gagal kirim.");
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <ShoppingBag className="w-4 h-4 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="font-bold text-sm truncate">{order.productName}</p>
            <p className="text-xs text-muted-foreground">{order.variantLabel}</p>
          </div>
        </div>
        <div className={`flex items-center gap-1.5 text-xs font-semibold shrink-0 ${cfg.color}`}>
          {cfg.icon}{cfg.label}
        </div>
      </div>

      <div className="px-4 py-3 space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Order ID</span><code className="font-mono text-xs font-bold">{order.id}</code></div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Harga</span>
          <span className="font-bold text-primary">{order.paymentMethod === "usdt" ? `$${order.amountUSDT} USDT` : formatCurrency(order.variantPrice)}</span>
        </div>
        <div className="flex justify-between"><span className="text-muted-foreground">Metode</span><span className="font-semibold uppercase">{order.paymentMethod}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Waktu</span><span className="text-xs">{new Date(order.createdAt).toLocaleString("id-ID")}</span></div>
      </div>

      {(order.status === "paid" || order.status === "verified") && order.key && (
        <div className="px-4 pb-4">
          <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-green-400 uppercase tracking-wider">License Key</p>
              {hasPin && (
                <button onClick={() => setUnlocked((u) => !u)} className="text-[10px] flex items-center gap-1 text-muted-foreground hover:text-foreground" title="Sembunyikan/Tampilkan">
                  {unlocked ? <><EyeOff className="w-3 h-3" />Sembunyikan</> : <><Eye className="w-3 h-3" />Buka</>}
                </button>
              )}
            </div>

            {unlocked ? (
              <div className="flex items-center gap-2">
                <code className="font-mono text-sm text-primary font-bold flex-1 break-all">{isMine ? order.key : maskKey(order.key)}</code>
                {isMine && (
                  <button onClick={copyKey} className="text-muted-foreground hover:text-primary shrink-0 transition-colors">
                    {copied ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-background/40 border border-border/60 rounded-lg p-2">
                  <Lock className="w-3.5 h-3.5" /> Key terkunci PIN. Masukkan PIN untuk melihat.
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    inputMode="numeric"
                    value={pinInput}
                    onChange={(e) => { setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6)); setPinErr(null); }}
                    placeholder="PIN"
                    onKeyDown={(e) => e.key === "Enter" && tryUnlock()}
                    className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono tracking-widest"
                  />
                  <button onClick={tryUnlock} className="px-3 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg">Buka</button>
                </div>
                {pinErr && <p className="text-[11px] text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {pinErr}</p>}
                <Link href="/profile">
                  <a className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2">Lupa PIN? Kelola di Profil →</a>
                </Link>
              </div>
            )}

            {/* Replaced badge */}
            {order.replacedAt && (
              <p className="mt-2 text-[10px] text-muted-foreground flex items-center gap-1">
                <RotateCcw className="w-3 h-3" /> Key diganti pada {new Date(order.replacedAt).toLocaleString("id-ID")}
              </p>
            )}
          </div>

          {/* Real-time countdown masa aktif key */}
          <KeyCountdown order={order} />

          {/* Warranty + service buttons */}
          {showServiceTools && (
            <>
              <div className="mt-3 rounded-xl border border-border/60 bg-muted/20 p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-primary" /> Garansi</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${w.active ? "bg-green-500/15 text-green-400 border border-green-500/30" : "bg-destructive/15 text-destructive border border-destructive/30"}`}>
                    {w.active ? `${w.daysLeft} hari lagi` : "EXPIRED"}
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all" style={{ width: `${(w.daysLeft / w.totalDays) * 100}%` }} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  Berlaku sampai {new Date(w.expiresAt).toLocaleDateString("id-ID")}
                  {order.warrantyClaimedAt && <> • <span className="text-yellow-400">Sudah pernah klaim</span></>}
                </p>

                <div className="grid grid-cols-3 gap-2 mt-3">
                  <button
                    disabled={busy || !w.active || !!order.warrantyClaimedAt}
                    onClick={onClaimWarranty}
                    className="py-2 text-[11px] font-bold rounded-lg bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                    title="Klaim garansi"
                  >
                    <Shield className="w-3 h-3" /> Klaim
                  </button>
                  <button
                    disabled={busy || !canReplace}
                    onClick={onReplaceKey}
                    className="py-2 text-[11px] font-bold rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                    title={order.replacedAt ? "Sudah pernah diganti" : "Ganti key 1×"}
                  >
                    <RotateCcw className="w-3 h-3" /> Replace
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => setShowBackup((s) => !s)}
                    className="py-2 text-[11px] font-bold rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400 hover:bg-sky-500/20 flex items-center justify-center gap-1"
                    title="Backup ke email"
                  >
                    <Mail className="w-3 h-3" /> Backup
                  </button>
                </div>

                {showBackup && (
                  <div className="mt-3 rounded-lg border border-border/60 bg-background p-3 space-y-2">
                    <p className="text-[10px] font-bold tracking-widest text-muted-foreground">KIRIM KEY KE EMAIL</p>
                    <input
                      type="email"
                      value={backupEmail}
                      onChange={(e) => setBackupEmail(e.target.value)}
                      placeholder="kamu@email.com"
                      className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm"
                    />
                    <button
                      disabled={busy}
                      onClick={onSendBackup}
                      className="w-full py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:brightness-110 disabled:opacity-50"
                    >
                      Kirim Sekarang
                    </button>
                    {order.backupSentAt && (
                      <p className="text-[10px] text-muted-foreground">
                        Terakhir dikirim: {new Date(order.backupSentAt).toLocaleString("id-ID")}
                      </p>
                    )}
                  </div>
                )}

                {actionMsg && (
                  <p className={`mt-2 text-[11px] flex items-center gap-1 ${actionMsg.kind === "ok" ? "text-green-400" : "text-destructive"}`}>
                    {actionMsg.kind === "ok" ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />} {actionMsg.text}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {order.status === "pending_verify" && (
        <div className="px-4 pb-4">
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400 shrink-0" />
            <p className="text-xs text-blue-300">Bukti transfer sedang diverifikasi admin. Maks 1×24 jam.</p>
          </div>
        </div>
      )}

      {order.status === "pending" && (
        <div className="px-4 pb-4">
          <Link href={`/payment/${order.paymentMethod}/${order.id}`}>
            <button className="w-full py-2.5 bg-primary/10 border border-primary/30 text-primary text-sm font-bold rounded-xl hover:bg-primary/20 transition-all">
              Lanjutkan Pembayaran →
            </button>
          </Link>
        </div>
      )}
    </div>
  );
}

type Tab = "mine" | "all";

function maskKey(k?: string) {
  if (!k) return "—";
  if (k.length <= 6) return "••••••";
  return k.slice(0, 3) + "•".repeat(Math.max(4, k.length - 6)) + k.slice(-3);
}

export default function History() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<Tab>("mine");

  const refresh = () => {
    if (user) {
      setOrders(getUserOrders(user.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }
    // "All Pembelian" = pembelian SUKSES dari pengguna nyata (paid / verified),
    // diurutkan terbaru. Kita TIDAK menggabungkan order dummy di sini supaya
    // jelas ini riwayat pembelian asli.
    setAllOrders(
      getOrders()
        .filter((o) => o.status === "verified" || o.status === "paid")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 100),
    );
  };

  useEffect(() => {
    refresh();
    const onPurchase = () => refresh();
    window.addEventListener("pinz_new_purchase", onPurchase);
    const t = setInterval(refresh, 15000);
    return () => {
      window.removeEventListener("pinz_new_purchase", onPurchase);
      clearInterval(t);
    };
  }, [user]);

  return (
    <div className="min-h-screen flex flex-col noise-bg">
      <Navbar />
      <main className="flex-1 py-8 pb-28">
        <div className="container mx-auto px-4 max-w-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">Riwayat Pembelian</h1>
              <p className="text-muted-foreground text-sm mt-0.5">{user ? `@${user.username}` : "Login untuk melihat pesanan"}</p>
            </div>
            {user && (
              <button onClick={refresh} className="p-2 rounded-xl border border-border hover:bg-muted transition-all">
                <RefreshCw className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>

          {!user ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4"><LogIn className="w-8 h-8 text-muted-foreground" /></div>
              <h2 className="text-xl font-bold mb-2">Login Dulu</h2>
              <p className="text-muted-foreground text-sm mb-6">Kamu perlu login untuk melihat riwayat pembelian.</p>
              <Link href="/login"><button className="px-6 py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-all">Login Sekarang</button></Link>
            </div>
          ) : (
            <>
              <div className="mb-5 bg-muted/20 border border-border/40 rounded-2xl p-1.5 flex gap-1.5">
                <button
                  onClick={() => setTab("mine")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                    tab === "mine"
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <ShoppingBag className="w-4 h-4" /> Pesanan Saya
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-black/30">{orders.length}</span>
                </button>
                <button
                  onClick={() => setTab("all")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                    tab === "all"
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Users className="w-4 h-4" /> All Pembelian
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-black/30">{allOrders.length}</span>
                </button>
              </div>

              {tab === "mine" ? (
                orders.length === 0 ? (
                  <div className="text-center py-20">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4"><ShoppingBag className="w-8 h-8 text-muted-foreground" /></div>
                    <h2 className="text-xl font-bold mb-2">Belum Ada Pesanan</h2>
                    <p className="text-muted-foreground text-sm mb-6">Kamu belum melakukan pembelian apapun.</p>
                    <Link href="/"><button className="px-6 py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-all">Lihat Katalog</button></Link>
                  </div>
                ) : (
                  <div className="space-y-4">{orders.map((o) => <OrderCard key={o.id} order={o} onMutate={refresh} />)}</div>
                )
              ) : (
                <AllPurchaseFeed orders={allOrders} currentUserId={user.id} />
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
      <HelpBar />
    </div>
  );
}

function AllPurchaseFeed({ orders, currentUserId }: { orders: Order[]; currentUserId: string }) {
  if (orders.length === 0) {
    return (
      <div className="text-center py-16 bg-card/40 border border-border/50 rounded-2xl">
        <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
          <Users className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="font-bold text-sm">Belum ada pembelian sukses</p>
        <p className="text-xs text-muted-foreground mt-1">Pembelian KEY oleh pengguna akan muncul di sini.</p>
      </div>
    );
  }
  return (
    <div className="bg-card/60 border border-border/60 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
        <p className="font-bold text-sm flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" /> Pembelian Pengguna
        </p>
        <span className="text-[10px] text-muted-foreground">Live · {orders.length} terbaru</span>
      </div>
      <ul className="divide-y divide-border/40 max-h-[640px] overflow-y-auto">
        {orders.map((o) => {
          const mine = o.userId === currentUserId;
          return (
            <li key={o.id} className="px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                <CheckCircle className="w-4 h-4 text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">
                  @{o.username}
                  {mine && <span className="ml-1.5 text-[10px] text-primary font-bold">(saya)</span>}
                  <span className="text-muted-foreground font-normal"> beli </span>
                  {o.productName}
                </p>
                <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                  <span>{o.variantLabel}</span>
                  <span>·</span>
                  <KeyRound className="w-3 h-3" />
                  <code className="font-mono text-[11px]">
                    {mine ? (o.key || "—") : maskKey(o.key)}
                  </code>
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-bold text-primary">{formatCurrency(o.variantPrice)}</p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(o.createdAt).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
