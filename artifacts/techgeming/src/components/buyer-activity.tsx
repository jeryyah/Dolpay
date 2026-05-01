import React, { useEffect, useState } from "react";
import {
  Area,
  Bar,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { TrendingUp, Users, Zap, ShoppingBag, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DUMMY, getOrders } from "@/lib/storage";

// "Naik Pesat" — daily activity. Setiap bar = 1 HARI kalender.
// Pola tidak boleh sama tiap minggu → kombinasi beberapa gelombang
// + tren naik + jitter deterministik per hari sehingga puncak & lembah
// selalu beda tinggi & lebar. Grafik hanya di-refresh saat tanggal
// kalender ganti (per HARI).
const DAYS_WINDOW = 30;
const DAY_CHECK_MS = 60_000;

const ID_MONTH = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
function fmtDayLabel(d: Date) {
  return `${d.getDate()} ${ID_MONTH[d.getMonth()]}`;
}

function epochDay(d: Date): number {
  return Math.floor(d.getTime() / 86_400_000);
}

// Pseudo-random deterministik berdasarkan hari + salt.
function dayHash(dayIdx: number, salt = 0): number {
  let h = (dayIdx * 2654435761 + salt * 374761393) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Nilai harian: superposisi 3 gelombang berbeda periode + drift naik
// + jitter besar + sesekali "spike" / "drop" event. Hasil: tidak ada
// dua minggu yang persis sama bentuknya.
function dayValueFor(dayIdx: number): number {
  const base = 280;
  const w1 = Math.sin((2 * Math.PI * dayIdx) / 6.3) * 90;     // gelombang ~1 minggu
  const w2 = Math.sin((2 * Math.PI * dayIdx) / 13.7 + 1.3) * 55; // ~2 minggu, fase berbeda
  const w3 = Math.sin((2 * Math.PI * dayIdx) / 31 + 0.4) * 40;   // ~bulanan, drift halus
  const trend = dayIdx * 0.18;                                 // tren naik tipis
  const jitter = (dayHash(dayIdx, 11) - 0.5) * 90;             // noise per hari
  const dow = ((dayIdx % 7) + 7) % 7;
  const weekend = dow === 5 || dow === 6 ? 35 : 0;             // sabtu-minggu rame
  // Sesekali ada lonjakan / kerontokan acak (event campaign / maintenance).
  const roll = dayHash(dayIdx, 23);
  const event = roll > 0.92 ? 110 : roll < 0.07 ? -120 : 0;
  return Math.max(40, Math.round(base + w1 + w2 + w3 + trend + jitter + weekend + event));
}

interface DataPoint {
  time: string;
  value: number;
  prev: number;
  delta: number;
  isUp: boolean;
}

function buildDataForToday(): DataPoint[] {
  const today = epochDay(new Date());
  const out: DataPoint[] = [];
  let prev = dayValueFor(today - DAYS_WINDOW);
  for (let i = DAYS_WINDOW - 1; i >= 0; i--) {
    const dayIdx = today - i;
    const d = new Date(dayIdx * 86_400_000);
    const value = dayValueFor(dayIdx);
    out.push({
      time: fmtDayLabel(d),
      value,
      prev,
      delta: value - prev,
      isUp: value >= prev,
    });
    prev = value;
  }
  return out;
}

function LiveDot() {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
    </span>
  );
}

export function BuyerActivity() {
  const { t } = useTranslation();
  const realOrders = getOrders();
  const realRecent = realOrders.filter((o) => o.status === "verified" || o.status === "paid").length;
  const realToday = realOrders.filter((o) => {
    const d = new Date(o.createdAt);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;

  const [liveCount, setLiveCount] = useState(DUMMY.TODAY + realToday);
  const [data, setData] = useState<DataPoint[]>(() => buildDataForToday());
  const lastDayRef = React.useRef(epochDay(new Date()));

  const fmtPlus = (n: number) => n.toLocaleString("id-ID") + "+";

  // Statistik ringkas dari data.
  const today = data[data.length - 1];
  const yesterday = data[data.length - 2];
  const dayDelta = today && yesterday ? today.value - yesterday.value : 0;
  const dayDeltaPct = yesterday && yesterday.value ? (dayDelta / yesterday.value) * 100 : 0;
  const peak = Math.max(...data.map((d) => d.value));
  const avg = Math.round(data.reduce((s, d) => s + d.value, 0) / Math.max(1, data.length));

  const STATS = [
    { label: t("stat_buyers"), value: fmtPlus(DUMMY.BUYERS + realOrders.length), icon: <Users className="w-4 h-4" />, color: "text-primary" },
    { label: t("stat_success"), value: "99.8%", icon: <Zap className="w-4 h-4" />, color: "text-green-400" },
    { label: "Transaksi Terbaru", value: fmtPlus(DUMMY.RECENT + realRecent), icon: <ShoppingBag className="w-4 h-4" />, color: "text-blue-400" },
    { label: t("stat_online"), value: liveCount.toLocaleString("id-ID"), icon: <TrendingUp className="w-4 h-4" />, color: "text-yellow-400" },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      const dayNow = epochDay(new Date());
      if (dayNow !== lastDayRef.current) {
        lastDayRef.current = dayNow;
        setData(buildDataForToday());
      }
      setLiveCount((c) => Math.max(800, c + Math.floor(Math.random() * 6) - 2));
    }, DAY_CHECK_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="py-12 px-4 bg-background border-t border-border/30">
      <div className="container mx-auto max-w-3xl">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <LiveDot />
              <span className="text-xs font-semibold text-green-400 uppercase tracking-widest">
                {t("buyers_live")}
              </span>
            </div>
            <h2 className="text-2xl font-bold">
              {t("buyers_title")} <span className="text-primary">{t("buyers_title2")}</span>
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              Pergerakan harian — {DAYS_WINDOW} hari terakhir.
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-primary tabular-nums leading-tight">
              {liveCount.toLocaleString("id-ID")}
            </p>
            <p className="text-xs text-muted-foreground">{t("stat_online")}</p>
          </div>
        </div>

        {/* New chart card — area + slim bars */}
        <div className="relative bg-gradient-to-br from-card/90 via-card/70 to-card/40 border border-border/60 rounded-2xl p-4 sm:p-5 mb-6 overflow-hidden">
          {/* Soft glow */}
          <div className="absolute -top-20 -right-20 w-56 h-56 bg-primary/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-16 w-56 h-56 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Mini summary row */}
          <div className="relative flex items-center justify-between mb-3 gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Hari Ini</p>
                <p className="text-2xl font-bold tabular-nums">{today?.value.toLocaleString("id-ID")}</p>
              </div>
              <div
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${
                  dayDelta >= 0
                    ? "bg-green-500/15 text-green-400 border border-green-500/30"
                    : "bg-red-500/15 text-red-400 border border-red-500/30"
                }`}
              >
                {dayDelta >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                {dayDelta >= 0 ? "+" : ""}
                {dayDelta} ({dayDeltaPct.toFixed(1)}%)
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div>
                <p className="text-muted-foreground text-[10px] uppercase tracking-wider">Rata2</p>
                <p className="font-bold tabular-nums">{avg.toLocaleString("id-ID")}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-[10px] uppercase tracking-wider">Puncak</p>
                <p className="font-bold tabular-nums text-primary">{peak.toLocaleString("id-ID")}</p>
              </div>
            </div>
          </div>

          {/* Composed chart: gradient area + slim daily bars */}
          <div className="relative">
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={data} margin={{ top: 8, right: 6, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="vrl-area-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a855f7" stopOpacity={0.55} />
                    <stop offset="60%" stopColor="#a855f7" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#a855f7" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="vrl-bar-up" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0.4} />
                  </linearGradient>
                  <linearGradient id="vrl-bar-down" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0.35} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1f1f1f" strokeDasharray="2 4" vertical={false} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10, fill: "#777" }}
                  tickLine={false}
                  axisLine={false}
                  interval={4}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#777" }}
                  tickLine={false}
                  axisLine={false}
                  domain={["auto", "auto"]}
                  width={42}
                />
                <Tooltip
                  cursor={{ fill: "rgba(168,85,247,0.08)" }}
                  contentStyle={{
                    background: "#0a0a0a",
                    border: "1px solid #2a2a2a",
                    borderRadius: 12,
                    fontSize: 11,
                    padding: "8px 10px",
                  }}
                  labelStyle={{ color: "#aaa", fontWeight: 600, marginBottom: 4 }}
                  formatter={(val: number, _name: string, ctx: any) => {
                    const d: DataPoint = ctx.payload;
                    const sign = d.delta >= 0 ? "+" : "";
                    return [
                      `${val.toLocaleString("id-ID")} pembeli  (${sign}${d.delta})`,
                      "",
                    ];
                  }}
                />
                <ReferenceLine y={avg} stroke="#a855f7" strokeDasharray="3 4" strokeOpacity={0.5} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#a855f7"
                  strokeWidth={2}
                  fill="url(#vrl-area-fill)"
                  isAnimationActive={false}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={10}>
                  {data.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.isUp ? "url(#vrl-bar-up)" : "url(#vrl-bar-down)"}
                    />
                  ))}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="relative flex items-center justify-between mt-3 flex-wrap gap-2">
            <div className="flex items-center gap-3 text-[11px]">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-gradient-to-b from-green-400 to-green-600" />
                <span className="text-muted-foreground">{t("buyers_up")}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-gradient-to-b from-red-400 to-red-600" />
                <span className="text-muted-foreground">{t("buyers_down")}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 border-t-2 border-dashed border-purple-400" />
                <span className="text-muted-foreground">Rata2</span>
              </div>
            </div>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              update tiap pergantian hari
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {STATS.map((stat, i) => (
            <div
              key={i}
              className="bg-muted/20 border border-border/50 rounded-xl p-3 flex flex-col gap-1"
            >
              <div className={`flex items-center gap-1.5 ${stat.color}`}>
                {stat.icon}
                <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
              </div>
              <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
