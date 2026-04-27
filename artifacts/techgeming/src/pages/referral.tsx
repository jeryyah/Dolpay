import React, { useEffect, useState } from "react";
import { Link } from "wouter";
import { Gift, Copy, Users, Sparkles, Share2, ArrowLeft, CheckCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Navbar, Footer } from "@/components/layout/navbar";
import { getReferralStats, applyReferralCode } from "@/lib/extra-storage";
import { formatCurrency } from "@/lib/utils";

export default function ReferralPage() {
  const { user, refresh: refreshAuth } = useAuth();
  const [stats, setStats] = useState<ReturnType<typeof getReferralStats> | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user) setStats(getReferralStats(user.id));
  }, [user?.id]);

  if (!user || !stats) return null;

  const link = typeof window !== "undefined"
    ? `${window.location.origin}${import.meta.env.BASE_URL}login?ref=${stats.code}`
    : `?ref=${stats.code}`;

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const apply = () => {
    setMsg(null);
    const r = applyReferralCode(user.id, code);
    if (r.ok) {
      setMsg({ kind: "ok", text: "Kode referral berhasil diaktifkan!" });
      setStats(getReferralStats(user.id));
      refreshAuth();
    } else {
      setMsg({ kind: "err", text: r.reason || "Gagal" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-6 max-w-3xl">
        <Link href="/">
          <a className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="w-4 h-4" /> Beranda
          </a>
        </Link>

        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-fuchsia-600 via-purple-600 to-indigo-600 p-6 mb-6 shadow-2xl shadow-purple-500/30">
          <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase text-white mb-3">
              <Sparkles className="w-3 h-3" /> Program Referral
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white mb-1">Ajak Teman, Dapat Bonus!</h1>
            <p className="text-sm text-white/80">Bagikan kode kamu — kalian berdua dapat <b>Rp25.000</b> saat teman daftar.</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Users className="w-3.5 h-3.5" /> Teman Diundang
            </div>
            <p className="text-3xl font-black">{stats.invitedCount}</p>
          </div>
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="flex items-center gap-2 text-xs text-emerald-300 mb-1">
              <Gift className="w-3.5 h-3.5" /> Total Bonus
            </div>
            <p className="text-3xl font-black text-emerald-400">{formatCurrency(stats.totalEarned)}</p>
          </div>
        </div>

        {/* Code */}
        <div className="rounded-2xl border border-border bg-card p-5 mb-6">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Kode Referral Kamu</p>
          <div className="flex items-stretch gap-2">
            <div className="flex-1 px-4 py-3 rounded-xl bg-background border border-border font-mono text-lg font-black tracking-widest text-primary">
              {stats.code}
            </div>
            <button
              onClick={() => copy(stats.code)}
              className="px-4 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center gap-1.5 hover:brightness-110 transition"
            >
              {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Disalin" : "Salin"}
            </button>
          </div>
          <button
            onClick={() => copy(link)}
            className="mt-2.5 w-full text-left px-3 py-2 rounded-xl border border-dashed border-border text-[11px] text-muted-foreground hover:text-foreground hover:border-primary flex items-center gap-2 truncate"
          >
            <Share2 className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{link}</span>
          </button>
        </div>

        {/* Apply code */}
        <div className="rounded-2xl border border-border bg-card p-5 mb-6">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Punya Kode Teman?</p>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="MASUKKAN-KODE"
              className="flex-1 px-3 py-2.5 rounded-xl bg-background border border-border font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary uppercase"
            />
            <button
              onClick={apply}
              disabled={!code.trim()}
              className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50"
            >
              Pakai
            </button>
          </div>
          {msg && (
            <p className={`text-xs mt-2 ${msg.kind === "ok" ? "text-emerald-400" : "text-rose-400"}`}>{msg.text}</p>
          )}
        </div>

        {/* Invited list */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <p className="text-sm font-bold flex items-center gap-2"><Users className="w-4 h-4" /> Daftar Undangan</p>
            <span className="text-xs text-muted-foreground">{stats.invited.length}</span>
          </div>
          {stats.invited.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Belum ada teman yang daftar pakai kode kamu</div>
          ) : (
            <div className="divide-y divide-border/40">
              {stats.invited.map((u, i) => (
                <div key={i} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold">@{u.username}</p>
                    <p className="text-[11px] text-muted-foreground">Bergabung {new Date(u.at).toLocaleDateString("id-ID")}</p>
                  </div>
                  <span className="text-xs font-black text-emerald-400">+Rp25.000</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
