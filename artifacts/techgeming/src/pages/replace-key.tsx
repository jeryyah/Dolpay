import React, { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft, RotateCcw, Copy, CheckCircle2, AlertTriangle, ShieldCheck,
  KeyRound, Search,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  getUserOrders, warrantyInfo, replaceKey, MAX_REPLACEMENTS,
} from "@/lib/storage";
import { formatCurrency } from "@/lib/utils";

export default function ReplaceKeyPage() {
  const { user, refresh } = useAuth();
  const [, navigate] = useLocation();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!user) { navigate("/login"); return null; }

  const orders = useMemo(
    () => getUserOrders(user.id)
      .filter((o) => (o.status === "verified" || o.status === "paid") && o.key)
      .map((o) => ({ ...o, w: warrantyInfo(o) })),
    [user.id, msg],
  );

  const eligible   = orders.filter((o) => !o.replacedAt && o.w.active);
  const used       = orders.filter((o) => !!o.replacedAt);
  const ineligible = orders.filter((o) => !o.replacedAt && !o.w.active);

  const filteredEligible = eligible.filter((o) =>
    !q || o.productName.toLowerCase().includes(q.toLowerCase()) || o.variantLabel.toLowerCase().includes(q.toLowerCase()),
  );

  const handleReplace = (id: string) => {
    if (!confirm("Replace key sekarang? Quota replace = 1× per order.")) return;
    setBusy(id);
    const r = replaceKey(id);
    setBusy(null);
    if (!r.ok) { setMsg("err:" + (r.error || "Gagal replace")); return; }
    setMsg("ok:Key baru berhasil dikeluarkan! Cek di bawah.");
    refresh?.();
    setTimeout(() => setMsg(null), 4000);
  };

  const copyKey = async (orderId: string, key: string) => {
    try { await navigator.clipboard.writeText(key); } catch { /* noop */ }
    setCopiedId(orderId);
    setTimeout(() => setCopiedId(null), 1500);
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
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-300 flex items-center justify-center">
              <RotateCcw className="w-4 h-4" />
            </div>
            <h1 className="font-bold text-base">Replace Key</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-5 max-w-3xl space-y-5">
        {/* Hero */}
        <section className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-amber-500/0 p-5 relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-amber-500/20 blur-3xl pointer-events-none" />
          <div className="relative flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <p className="font-extrabold text-lg leading-tight">Tukar Key Sekali Klik</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Selama masa garansi, kamu bisa replace key {MAX_REPLACEMENTS}× per order. Key lama otomatis dipensiunkan.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-background/50 border border-border/60 rounded-xl p-3">
              <p className="text-[10px] tracking-widest text-muted-foreground">BISA REPLACE</p>
              <p className="text-2xl font-extrabold text-amber-400 mt-0.5">{eligible.length}</p>
            </div>
            <div className="bg-background/50 border border-border/60 rounded-xl p-3">
              <p className="text-[10px] tracking-widest text-muted-foreground">SUDAH PAKAI</p>
              <p className="text-2xl font-extrabold text-fuchsia-400 mt-0.5">{used.length}</p>
            </div>
            <div className="bg-background/50 border border-border/60 rounded-xl p-3">
              <p className="text-[10px] tracking-widest text-muted-foreground">DI LUAR GARANSI</p>
              <p className="text-2xl font-extrabold text-muted-foreground mt-0.5">{ineligible.length}</p>
            </div>
          </div>
        </section>

        {msg && (
          <div className={`rounded-xl border px-4 py-3 text-sm flex items-start gap-2
            ${msg.startsWith("ok") ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                                   : "border-destructive/30 bg-destructive/10 text-destructive"}`}>
            {msg.startsWith("ok") ? <CheckCircle2 className="w-4 h-4 mt-0.5" /> : <AlertTriangle className="w-4 h-4 mt-0.5" />}
            <span>{msg.slice(3)}</span>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari produk untuk di-replace..."
            className="w-full pl-9 pr-3 py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-amber-500/50"
          />
        </div>

        {/* Eligible list */}
        <section className="space-y-3">
          <p className="text-xs font-bold tracking-widest text-muted-foreground">BISA REPLACE</p>
          {filteredEligible.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 p-8 text-center">
              <p className="text-sm font-bold">Tidak ada order yang bisa di-replace</p>
              <p className="text-[11px] text-muted-foreground mt-1">Kamu akan melihat order kamu di sini selama masih dalam masa garansi.</p>
            </div>
          ) : filteredEligible.map((o) => (
            <article key={o.id} className="rounded-2xl border border-border/60 bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{o.productName}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {o.variantLabel} · {formatCurrency(o.finalPriceIDR ?? o.variantPrice)}
                  </p>
                </div>
                <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  <ShieldCheck className="w-3 h-3" /> {o.w.daysLeft}h garansi
                </span>
              </div>

              <div className="mt-3 bg-background/50 border border-border rounded-xl p-3 font-mono text-xs flex items-center justify-between gap-2">
                <span className="truncate">{o.key}</span>
                <button
                  onClick={() => copyKey(o.id, o.key!)}
                  className="shrink-0 p-1.5 rounded-md hover:bg-muted text-muted-foreground"
                  title="Copy key lama"
                >
                  {copiedId === o.id ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              <button
                onClick={() => handleReplace(o.id)}
                disabled={busy === o.id}
                className="w-full mt-3 py-2.5 bg-amber-500 text-black font-extrabold text-xs rounded-xl hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${busy === o.id ? "animate-spin" : ""}`} />
                {busy === o.id ? "Menukar..." : "Replace Key Sekarang"}
              </button>
            </article>
          ))}
        </section>

        {/* Used */}
        {used.length > 0 && (
          <section className="space-y-3">
            <p className="text-xs font-bold tracking-widest text-muted-foreground">SUDAH PERNAH DI-REPLACE</p>
            {used.map((o) => (
              <article key={o.id} className="rounded-2xl border border-border/60 bg-card/60 p-4 opacity-90">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{o.productName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Diganti {new Date(o.replacedAt!).toLocaleDateString("id-ID")} · key lama: {o.oldKeys?.length ?? 0}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-full bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30">
                    QUOTA HABIS
                  </span>
                </div>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
