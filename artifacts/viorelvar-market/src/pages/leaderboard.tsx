import React, { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Crown, Award, Medal, Sparkles, Gift, Clock } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getLeaderboard, type LeaderboardRow } from "@/lib/storage";
import { formatCurrency } from "@/lib/utils";

const TIER_STYLE: Record<string, { grad: string; ic: React.ReactNode }> = {
  Bronze: { grad: "from-amber-700 to-amber-500",   ic: <Medal className="w-3 h-3" /> },
  Silver: { grad: "from-slate-400 to-slate-200",   ic: <Award className="w-3 h-3" /> },
  Gold:   { grad: "from-yellow-500 to-amber-300",  ic: <Crown className="w-3 h-3" /> },
  VIP:    { grad: "from-fuchsia-500 to-purple-400",ic: <Sparkles className="w-3 h-3" /> },
};

const PRIZES = [
  { rank: 1, prize: "Saldo IDR 500.000 + Badge VIP",      grad: "from-yellow-400 to-amber-500" },
  { rank: 2, prize: "Saldo IDR 250.000 + Diskon 50%",     grad: "from-slate-300 to-slate-500" },
  { rank: 3, prize: "Saldo IDR 100.000 + Diskon 30%",     grad: "from-amber-600 to-amber-800" },
];

function useCountdownToNextMonth() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const next = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
  }, []);
  const ms = Math.max(0, next - now);
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  const secs = Math.floor((ms % 60_000) / 1000);
  return { days, hours, mins, secs };
}

export default function Leaderboard() {
  const { user } = useAuth();
  const rows = useMemo(() => getLeaderboard(user?.id, 50), [user?.id]);
  const me = rows.find((r) => r.isMe);
  const { days, hours, mins, secs } = useCountdownToNextMonth();
  const monthName = new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="container mx-auto px-4 h-14 flex items-center gap-3 max-w-3xl">
          <Link href="/">
            <button className="p-2 -ml-2 rounded-lg hover:bg-muted text-muted-foreground">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <h1 className="font-bold text-base flex items-center gap-2">
            <Crown className="w-4 h-4 text-yellow-400" /> Top Buyer {monthName}
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-5 max-w-3xl space-y-5">
        {/* Countdown banner */}
        <section className="rounded-2xl p-4 border border-border/60 bg-gradient-to-br from-fuchsia-500/15 via-purple-500/10 to-amber-500/15">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" /> Reset & bagi hadiah otomatis dalam:
          </div>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {[
              { v: days, l: "HARI" },
              { v: hours, l: "JAM" },
              { v: mins, l: "MENIT" },
              { v: secs, l: "DETIK" },
            ].map((c, i) => (
              <div key={i} className="rounded-xl bg-card border border-border/60 py-2 text-center">
                <p className="text-xl font-extrabold tabular-nums">{String(c.v).padStart(2, "0")}</p>
                <p className="text-[9px] text-muted-foreground tracking-widest">{c.l}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Prizes */}
        <section className="rounded-2xl border border-border/60 bg-card p-4">
          <p className="font-bold text-sm flex items-center gap-2 mb-3">
            <Gift className="w-4 h-4 text-pink-400" /> Hadiah Top 3 (otomatis akhir bulan)
          </p>
          <div className="space-y-2">
            {PRIZES.map((p) => (
              <div key={p.rank} className="flex items-center gap-3 rounded-xl bg-muted/30 border border-border/60 p-3">
                <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${p.grad} text-white font-extrabold flex items-center justify-center shadow`}>
                  #{p.rank}
                </div>
                <p className="text-sm font-medium flex-1">{p.prize}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Podium */}
        {top3.length > 0 && (
          <section className="rounded-2xl border border-border/60 bg-card p-4">
            <div className="grid grid-cols-3 gap-3 items-end">
              {[top3[1], top3[0], top3[2]].filter(Boolean).map((r, i) => {
                const heights = [88, 120, 72];
                const ranks   = [2, 1, 3];
                const grads   = ["from-slate-300 to-slate-500", "from-yellow-400 to-amber-500", "from-amber-600 to-amber-800"];
                return (
                  <PodiumCard key={r.userId} row={r} rank={ranks[i]} h={heights[i]} grad={grads[i]} />
                );
              })}
            </div>
          </section>
        )}

        {/* My rank */}
        {me && (
          <section className="rounded-2xl border border-primary/40 bg-primary/5 p-4">
            <p className="text-[10px] tracking-widest text-primary font-bold mb-2">PERINGKAT KAMU</p>
            <RankRow row={me} highlight />
          </section>
        )}

        {/* Rest of leaderboard */}
        <section className="rounded-2xl border border-border/60 bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
            <p className="font-bold text-sm">Peringkat #4 – #50</p>
            <p className="text-[10px] text-muted-foreground">{rows.length} buyer</p>
          </div>
          <div className="divide-y divide-border/60">
            {rest.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">Belum ada peringkat lain.</div>
            )}
            {rest.map((r) => (
              <RankRow key={r.userId} row={r} />
            ))}
          </div>
        </section>

        <p className="text-[10px] text-center text-muted-foreground">
          Data leaderboard direset tiap awal bulan. Top 3 dapat hadiah otomatis terkredit.
        </p>
      </main>
    </div>
  );
}

function PodiumCard({ row, rank, h, grad }: { row: LeaderboardRow; rank: number; h: number; grad: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <div className="w-14 h-14 rounded-full ring-2 ring-card overflow-hidden bg-muted flex items-center justify-center text-base font-extrabold">
          {row.avatarBase64
            ? <img src={row.avatarBase64} alt="" className="w-full h-full object-cover" />
            : (row.nickname || row.username)[0]?.toUpperCase()}
        </div>
        <span className={`absolute -top-2 -right-2 w-6 h-6 rounded-full text-[10px] font-extrabold text-white bg-gradient-to-br ${grad} flex items-center justify-center shadow ring-2 ring-card`}>
          {rank}
        </span>
      </div>
      <p className="mt-1.5 text-xs font-bold truncate max-w-full px-1 text-center">{row.nickname || row.username}</p>
      <p className="text-[10px] text-muted-foreground">{formatCurrency(row.totalSpend)}</p>
      <div className={`mt-2 w-full rounded-t-xl bg-gradient-to-t ${grad}`} style={{ height: h }} />
    </div>
  );
}

function RankRow({ row, highlight }: { row: LeaderboardRow; highlight?: boolean }) {
  const t = TIER_STYLE[row.tier] || TIER_STYLE.Bronze;
  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${highlight ? "" : "hover:bg-muted/30"}`}>
      <span className={`w-7 text-center text-xs font-extrabold ${row.rank <= 3 ? "text-yellow-400" : "text-muted-foreground"}`}>
        #{row.rank}
      </span>
      <div className="w-9 h-9 rounded-full overflow-hidden bg-muted flex items-center justify-center text-xs font-bold shrink-0">
        {row.avatarBase64
          ? <img src={row.avatarBase64} alt="" className="w-full h-full object-cover" />
          : (row.nickname || row.username)[0]?.toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate flex items-center gap-1.5">
          {row.nickname || row.username}
          {row.isMe && <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary text-primary-foreground">KAMU</span>}
        </p>
        <p className="text-[10px] text-muted-foreground">{row.totalOrders}× pembelian</p>
      </div>
      <div className="text-right">
        <p className="text-xs font-extrabold tabular-nums">{formatCurrency(row.totalSpend)}</p>
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold text-white bg-gradient-to-r ${t.grad}`}>
          {t.ic}{row.tier}
        </span>
      </div>
    </div>
  );
}
