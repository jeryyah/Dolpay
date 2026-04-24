import React, { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft, Shield, ShieldCheck, ShieldAlert, CheckCircle2, Clock, AlertTriangle,
  Sparkles, Info, FileCheck2,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  getUserOrders, warrantyInfo, claimWarranty, DEFAULT_WARRANTY_DAYS,
} from "@/lib/storage";
import { formatCurrency } from "@/lib/utils";

type Tab = "active" | "expired" | "claimed";

export default function GaransiKey() {
  const { user, refresh } = useAuth();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<Tab>("active");
  const [msg, setMsg] = useState<string | null>(null);

  if (!user) { navigate("/login"); return null; }

  const orders = useMemo(
    () => getUserOrders(user.id).filter((o) => o.status === "verified" || o.status === "paid"),
    [user.id, msg],
  );

  const enriched = orders.map((o) => ({ ...o, w: warrantyInfo(o) }));
  const active   = enriched.filter((o) => o.w.active && !o.warrantyClaimedAt);
  const claimed  = enriched.filter((o) => !!o.warrantyClaimedAt);
  const expired  = enriched.filter((o) => !o.w.active && !o.warrantyClaimedAt);

  const list = tab === "active" ? active : tab === "claimed" ? claimed : expired;

  const totalActive   = active.length;
  const claimableSoon = active.filter((o) => o.w.daysLeft <= 7).length;

  const handleClaim = (id: string) => {
    if (!confirm("Klaim garansi untuk order ini?")) return;
    const r = claimWarranty(id);
    if (!r.ok) { setMsg("err:" + (r.error || "Gagal klaim")); return; }
    setMsg("ok:Garansi berhasil diklaim. Tim kami akan menghubungi kamu.");
    refresh?.();
    setTimeout(() => setMsg(null), 3500);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="container mx-auto px-4 h-14 flex items-center gap-3 max-w-3xl">
          <Link href="/">
            <button className="p-2 -ml-2 rounded-lg hover:bg-muted text-muted-foreground">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            <h1 className="font-bold text-base">Garansi Key</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-5 max-w-3xl space-y-5">
        {/* Hero info */}
        <section className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-emerald-500/0 p-5">
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none" />
          <div className="relative flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Garansi otomatis</p>
              <p className="font-extrabold text-lg leading-tight">{DEFAULT_WARRANTY_DAYS} Hari Penuh</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Setiap pembelian terverifikasi otomatis dapat garansi {DEFAULT_WARRANTY_DAYS} hari sejak tanggal pembayaran.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-background/50 border border-border/60 rounded-xl p-3">
              <p className="text-[10px] tracking-widest text-muted-foreground">AKTIF</p>
              <p className="text-2xl font-extrabold text-emerald-400 mt-0.5">{totalActive}</p>
            </div>
            <div className="bg-background/50 border border-border/60 rounded-xl p-3">
              <p className="text-[10px] tracking-widest text-muted-foreground">SEGERA HABIS</p>
              <p className="text-2xl font-extrabold text-amber-400 mt-0.5">{claimableSoon}</p>
              <p className="text-[10px] text-muted-foreground">≤ 7 hari lagi</p>
            </div>
          </div>
        </section>

        {/* Status flash */}
        {msg && (
          <div className={`rounded-xl border px-4 py-3 text-sm flex items-start gap-2
            ${msg.startsWith("ok") ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                   : "border-destructive/30 bg-destructive/10 text-destructive"}`}>
            {msg.startsWith("ok") ? <CheckCircle2 className="w-4 h-4 mt-0.5" /> : <AlertTriangle className="w-4 h-4 mt-0.5" />}
            <span>{msg.slice(3)}</span>
          </div>
        )}

        {/* Tabs */}
        <div className="grid grid-cols-3 bg-card border border-border/60 rounded-xl p-1 text-xs font-bold">
          {([
            { id: "active",  label: `Aktif (${active.length})`,    color: "bg-emerald-500/20 text-emerald-300" },
            { id: "expired", label: `Habis (${expired.length})`,   color: "bg-muted text-foreground" },
            { id: "claimed", label: `Diklaim (${claimed.length})`, color: "bg-fuchsia-500/20 text-fuchsia-300" },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`py-2 rounded-lg transition-all ${tab === t.id ? t.color : "text-muted-foreground hover:text-foreground"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* List */}
        <section className="space-y-3">
          {list.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 p-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                <ShieldAlert className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="font-bold">Belum ada order di tab ini</p>
              <p className="text-xs text-muted-foreground mt-1">Order kamu yang sesuai akan muncul di sini.</p>
            </div>
          ) : list.map((o) => (
            <article key={o.id} className="rounded-2xl border border-border/60 bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{o.productName}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{o.variantLabel} · {formatCurrency(o.finalPriceIDR ?? o.variantPrice)}</p>
                </div>
                {tab === "active" && (
                  <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    <Clock className="w-3 h-3" /> {o.w.daysLeft} hari
                  </span>
                )}
                {tab === "claimed" && (
                  <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30">
                    <FileCheck2 className="w-3 h-3" /> Diklaim
                  </span>
                )}
                {tab === "expired" && (
                  <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-muted text-muted-foreground border border-border">
                    Habis
                  </span>
                )}
              </div>

              <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-all"
                  style={{ width: `${Math.min(100, (o.w.daysLeft / o.w.totalDays) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>Order #{o.id.slice(-6).toUpperCase()}</span>
                <span>Berlaku hingga {new Date(o.w.expiresAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</span>
              </div>

              {tab === "active" && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleClaim(o.id)}
                    className="flex-1 py-2 bg-emerald-500 text-black font-extrabold text-xs rounded-xl hover:brightness-110 flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Klaim Garansi
                  </button>
                  <Link href="/replace-key">
                    <a className="px-3 py-2 border border-border rounded-xl text-xs font-bold hover:bg-muted">
                      Replace Key
                    </a>
                  </Link>
                </div>
              )}
              {tab === "claimed" && o.warrantyClaimedAt && (
                <p className="text-[11px] text-muted-foreground mt-2">
                  Diklaim pada {new Date(o.warrantyClaimedAt).toLocaleString("id-ID")}.
                </p>
              )}
            </article>
          ))}
        </section>

        {/* Terms */}
        <section className="rounded-2xl border border-border/60 bg-card p-5 space-y-2">
          <p className="font-bold text-sm flex items-center gap-2">
            <Info className="w-4 h-4 text-primary" /> Syarat Garansi
          </p>
          <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-5">
            <li>Berlaku {DEFAULT_WARRANTY_DAYS} hari sejak order terverifikasi/lunas.</li>
            <li>Klaim garansi hanya bisa dilakukan 1× per order.</li>
            <li>Replace key otomatis tersedia jika stok masih ada.</li>
            <li>Garansi gugur jika key terbukti dipakai melanggar ketentuan publisher.</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
