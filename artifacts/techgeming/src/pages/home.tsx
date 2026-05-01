import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import {
  ShieldCheck, Zap, Lock, RefreshCw,
  ChevronRight, ChevronLeft, Crown, Sparkles, Award, Medal,
  Send, Smartphone, HelpCircle, Headphones,
  Shield, Star, Headset, Megaphone, X, Search as SearchIcon, Gamepad2,
  Key, ArrowRight,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart,
} from "recharts";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/product-card";
import { TGMonogramHero } from "@/components/brand/tg-monogram";
import { useAuth } from "@/lib/auth-context";
import { getAllProducts, getCategories, getUserLevel, getUserOrders, getAnnouncement } from "@/lib/storage";
import { useStorageVersion } from "@/lib/use-live-storage";
import { type ProductCategory } from "@/data/products";

const TIER_ICON: Record<string, React.ReactNode> = {
  Bronze: <Medal className="w-3.5 h-3.5" />,
  Silver: <Award className="w-3.5 h-3.5" />,
  Gold:   <Crown className="w-3.5 h-3.5" />,
  VIP:    <Sparkles className="w-3.5 h-3.5" />,
};

/* ────────── HERO — Welcome card with TG monogram ────────── */
function WelcomeHero() {
  const { user } = useAuth();
  const lvl = user ? getUserLevel(user.id) : null;
  const memberDays = user
    ? Math.max(1, Math.floor((Date.now() - new Date(user.createdAt || Date.now()).getTime()) / 86400000))
    : 0;

  const QUICK_STATS = [
    { icon: <ShieldCheck className="w-4 h-4" />, title: "Garansi Key",       sub: "30 Hari" },
    { icon: <Zap className="w-4 h-4" />,         title: "Instant Delivery",  sub: "1–5 Menit" },
    { icon: <Lock className="w-4 h-4" />,        title: "Aman & Terpercaya", sub: "100% Aman" },
    { icon: <RefreshCw className="w-4 h-4" />,   title: "Update Rutin",      sub: "Setiap Hari" },
  ];

  return (
    <section className="relative">
      <div className="relative overflow-hidden rounded-[28px] border border-amber-500/20 bg-gradient-to-br from-[#15110a] via-[#0d0a05] to-black p-6 sm:p-8">
        {/* Decorative grid */}
        <div className="absolute inset-0 opacity-[.07] pointer-events-none"
             style={{
               backgroundImage:
                 "linear-gradient(to right, rgba(242,194,92,.6) 1px, transparent 1px), linear-gradient(to bottom, rgba(242,194,92,.6) 1px, transparent 1px)",
               backgroundSize: "40px 40px",
               maskImage: "radial-gradient(ellipse 60% 80% at 80% 50%, #000 30%, transparent 80%)",
               WebkitMaskImage: "radial-gradient(ellipse 60% 80% at 80% 50%, #000 30%, transparent 80%)",
             }}
        />
        {/* Glow */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-12 w-72 h-72 rounded-full bg-amber-700/10 blur-3xl pointer-events-none" />

        <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-center">
          <div className="min-w-0">
            <p className="text-xs sm:text-sm text-muted-foreground">Selamat datang kembali,</p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight truncate">
                {user ? (user.nickname || user.username) : "Gamer"}
              </h1>
              {lvl && (
                <span className={`inline-flex items-center gap-1.5 text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-gradient-to-r ${lvl.gradient} text-black shadow-lg`}>
                  {TIER_ICON[lvl.tier]} {lvl.tier}
                </span>
              )}
            </div>
            <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground">
              {user ? `Member sejak ${memberDays} hari yang lalu` : "Login dulu untuk akses semua fitur premium"}
            </p>

            {/* Quick stats */}
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {QUICK_STATS.map((s, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-amber-500/15 bg-black/40 backdrop-blur-sm px-3 py-3 hover:border-amber-500/40 transition-colors"
                >
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-300 flex items-center justify-center mb-1.5">
                    {s.icon}
                  </div>
                  <p className="text-[12px] font-bold leading-tight">{s.title}</p>
                  <p className="text-[10.5px] text-muted-foreground">{s.sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* TG monogram visual */}
          <div className="hidden md:block shrink-0">
            <TGMonogramHero />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ────────── POPULAR PRODUCTS — horizontal scroll carousel ────────── */
function PopularProducts() {
  const storageVer = useStorageVersion();
  const products = React.useMemo(() => {
    return getAllProducts()
      .slice()
      .sort((a, b) => (b.soldCount || 0) - (a.soldCount || 0))
      .slice(0, 10);
  }, [storageVer]);

  const trackRef = React.useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 320, behavior: "smooth" });
  };

  if (products.length === 0) return null;

  return (
    <section className="mt-6">
      <div className="flex items-end justify-between mb-4 px-1">
        <div>
          <h2 className="text-lg sm:text-xl font-black flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-300" />
            Produk Terpopuler
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/wishlist">
            <a className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-amber-300 hover:text-amber-200">
              Lihat Semua <ChevronRight className="w-3.5 h-3.5" />
            </a>
          </Link>
          <button
            onClick={() => scroll(-1)}
            className="hidden sm:inline-flex w-9 h-9 rounded-full border border-border/60 bg-card hover:border-amber-500/40 items-center justify-center"
            aria-label="Geser kiri"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scroll(1)}
            className="hidden sm:inline-flex w-9 h-9 rounded-full border border-border/60 bg-card hover:border-amber-500/40 items-center justify-center"
            aria-label="Geser kanan"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div
        ref={trackRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2 -mx-1 px-1"
      >
        {products.map((p) => (
          <div key={p.id} className="snap-start shrink-0 w-[210px] sm:w-[230px]">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}

/* ────────── ACTIVITY SUMMARY — stats + line chart ────────── */
function ActivitySummary() {
  const [range, setRange] = useState<"7d" | "30d" | "90d">("30d");

  // Synthetic but stable activity series
  const data = React.useMemo(() => {
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    const out: { day: string; value: number }[] = [];
    let v = 600;
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      v = Math.max(120, Math.min(1500, v + (Math.sin(i * 0.6) * 220) + (Math.random() * 120 - 60)));
      out.push({
        day: d.toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
        value: Math.round(v),
      });
    }
    return out;
  }, [range]);

  const peak = React.useMemo(() => data.reduce((m, x) => (x.value > m.value ? x : m), data[0]), [data]);

  const STATS = [
    { icon: <Sparkles className="w-4 h-4" />, label: "Total Pengunjung", value: "15.470+", delta: "+12,5%", up: true },
    { icon: <Star className="w-4 h-4" />,    label: "Transaksi Sukses", value: "99,8%",   delta: "+2,1%",  up: true },
    { icon: <Zap className="w-4 h-4" />,     label: "Waktu Rata-rata",  value: "2m 40d",  delta: "-8,7%",  up: true },
    { icon: <Crown className="w-4 h-4" />,   label: "Produk Terjual",   value: "1.249",   delta: "+15,4%", up: true },
  ];

  return (
    <section className="mt-8">
      <div className="rounded-3xl border border-amber-500/15 bg-[hsl(36_16%_6%)] p-5 sm:p-6 relative overflow-hidden">
        <div className="absolute -top-20 -right-10 w-72 h-72 rounded-full bg-amber-500/5 blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between gap-3 mb-5">
          <h2 className="text-lg sm:text-xl font-black flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-300 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </span>
            Ringkasan Aktivitas
          </h2>
          <div className="relative">
            <select
              value={range}
              onChange={(e) => setRange(e.target.value as any)}
              className="appearance-none cursor-pointer text-xs font-bold bg-black/40 border border-border/60 hover:border-amber-500/40 rounded-xl pl-3 pr-8 py-2 focus:outline-none"
            >
              <option value="7d">7 Hari Terakhir</option>
              <option value="30d">30 Hari Terakhir</option>
              <option value="90d">90 Hari Terakhir</option>
            </select>
            <ChevronRight className="w-3.5 h-3.5 rotate-90 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        <div className="relative grid grid-cols-1 md:grid-cols-[230px_1fr] gap-5">
          {/* Stats column */}
          <div className="grid grid-cols-2 md:grid-cols-1 gap-2.5">
            {STATS.map((s, i) => (
              <div
                key={i}
                className="rounded-2xl border border-border/60 bg-black/30 px-3 py-2.5 flex items-start gap-2.5"
              >
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-300 flex items-center justify-center shrink-0">
                  {s.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-muted-foreground leading-tight">{s.label}</p>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <p className="text-base font-extrabold">{s.value}</p>
                    <span className={`text-[10px] font-bold ${s.up ? "text-emerald-400" : "text-rose-400"}`}>
                      {s.delta}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="relative h-[260px] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="goldFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F2C25C" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#F2C25C" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false} />
                <XAxis
                  dataKey="day"
                  stroke="rgba(255,255,255,.45)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  interval={Math.max(0, Math.floor(data.length / 6) - 1)}
                />
                <YAxis
                  stroke="rgba(255,255,255,.35)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : `${v}`}
                />
                <Tooltip
                  contentStyle={{
                    background: "rgba(0,0,0,.9)",
                    border: "1px solid rgba(242,194,92,.35)",
                    borderRadius: 12,
                    fontSize: 12,
                    color: "#fff",
                  }}
                  cursor={{ stroke: "rgba(242,194,92,.4)", strokeWidth: 1 }}
                  formatter={(v: number) => [`${v.toLocaleString("id-ID")} aktivitas`, ""]}
                  labelStyle={{ color: "#F2C25C", fontWeight: 700 }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#F2C25C"
                  strokeWidth={2.5}
                  fill="url(#goldFill)"
                  dot={false}
                  activeDot={{ r: 5, fill: "#FFE9A8", stroke: "#F2C25C", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
            {peak && (
              <div className="absolute right-4 top-3 rounded-xl border border-amber-500/30 bg-black/80 backdrop-blur-md px-3 py-2 text-right pointer-events-none">
                <p className="text-[10px] text-muted-foreground">Puncak</p>
                <p className="text-sm font-extrabold text-amber-200">{peak.value.toLocaleString("id-ID")}</p>
                <p className="text-[10px] text-muted-foreground">{peak.day}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ────────── WHY CHOOSE US ────────── */
function WhyChooseUs() {
  const FEATURES = [
    { icon: <Shield className="w-6 h-6" />,    title: "Aman 100%",         sub: "Sistem anti banned & terjamin aman digunakan." },
    { icon: <Zap className="w-6 h-6" />,       title: "Proses Instant",    sub: "Proses otomatis, langsung dikirim." },
    { icon: <Crown className="w-6 h-6" />,     title: "Kualitas Premium",  sub: "Cheat premium dengan update rutin." },
    { icon: <Headset className="w-6 h-6" />,   title: "Support Profesional", sub: "Tim support siap membantu kapanpun." },
  ];

  return (
    <section className="mt-8">
      <div className="rounded-3xl border border-amber-500/25 bg-gradient-to-br from-[#15110a] via-[#0d0a05] to-black p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-[80%] h-32 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="text-center mb-7 relative">
          <h2 className="text-xl sm:text-2xl font-black">
            Kenapa Pilih <span className="text-gold-grad">TECHGEMING</span> Store?
          </h2>
        </div>
        <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((f, i) => (
            <div key={i} className="text-center p-3">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center justify-center mb-3 shadow-[inset_0_0_20px_rgba(242,194,92,.15)]">
                {f.icon}
              </div>
              <p className="text-[13px] sm:text-sm font-extrabold text-amber-100">{f.title}</p>
              <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{f.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────── HELP SECTION ────────── */
function HelpSection() {
  return (
    <section className="mt-8">
      <div className="rounded-3xl border border-border/60 bg-[hsl(36_16%_6%)] p-5 sm:p-6 relative overflow-hidden">
        <div className="absolute right-2 top-2 bottom-2 w-32 sm:w-44 hidden sm:block pointer-events-none">
          <div className="w-full h-full rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-700/5 to-transparent flex items-center justify-center">
            <Headphones className="w-20 h-20 text-amber-400/60" strokeWidth={1.4} />
          </div>
        </div>
        <div className="relative max-w-[560px]">
          <h3 className="text-lg sm:text-xl font-black">Butuh Bantuan?</h3>
          <p className="text-xs text-muted-foreground mt-1">Kami siap membantu kamu kapan pun dibutuhkan.</p>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <a
              href="https://t.me/GURUGAMING_UPDATE"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-2xl border border-border/60 bg-black/40 hover:border-amber-500/40 px-3 py-2.5"
            >
              <div className="w-9 h-9 rounded-xl bg-sky-500/15 text-sky-300 flex items-center justify-center">
                <Send className="w-4 h-4" />
              </div>
              <div className="leading-tight">
                <p className="text-sm font-extrabold">Telegram</p>
                <p className="text-[10px] text-muted-foreground">@vleorideCheats</p>
              </div>
            </a>
            <a
              href="https://t.me/GURUGAMING_UPDATE"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-2xl border border-border/60 bg-black/40 hover:border-amber-500/40 px-3 py-2.5"
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-300 flex items-center justify-center">
                <Smartphone className="w-4 h-4" />
              </div>
              <div className="leading-tight">
                <p className="text-sm font-extrabold">Download Aplikasi</p>
                <p className="text-[10px] text-muted-foreground">@GURUGAMING_UPDATE</p>
              </div>
            </a>
            <Link href="/faq">
              <a className="flex items-center gap-3 rounded-2xl border border-border/60 bg-black/40 hover:border-amber-500/40 px-3 py-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-300 flex items-center justify-center">
                  <HelpCircle className="w-4 h-4" />
                </div>
                <div className="leading-tight">
                  <p className="text-sm font-extrabold">FAQ</p>
                  <p className="text-[10px] text-muted-foreground">Pertanyaan Umum</p>
                </div>
              </a>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ────────── MY KEYS — Quick-access card to license keys ────────── */
function MyKeysCard() {
  const { user } = useAuth();
  const storageVer = useStorageVersion();
  const stats = React.useMemo(() => {
    if (!user) return { total: 0, active: 0, lifetime: 0 };
    const orders = getUserOrders(user.id).filter(
      (o) => (o.status === "paid" || o.status === "verified") && !!o.key,
    );
    const now = Date.now();
    let active = 0, lifetime = 0;
    for (const o of orders) {
      if (!o.durationMs || o.durationMs === 0) lifetime++;
      else if (o.expiresAt && new Date(o.expiresAt).getTime() > now) active++;
    }
    return { total: orders.length, active, lifetime };
  }, [user?.id, storageVer]);

  if (!user) return null;

  return (
    <section className="mt-6">
      <Link href="/my-keys">
        <a className="block group rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent hover:from-amber-500/25 hover:border-amber-400/50 transition-all p-5 sm:p-6 relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-amber-500/10 blur-2xl pointer-events-none" />
          <div className="relative flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shrink-0">
              <Key className="w-7 h-7 text-black" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg sm:text-xl font-black">Ambil Key Saya</h3>
                {stats.total > 0 && (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-500/40">
                    {stats.total} key
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.total === 0
                  ? "Belum ada key. Beli produk untuk dapat key langsung."
                  : `${stats.active} aktif · ${stats.lifetime} lifetime · klik untuk lihat & copy.`}
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-amber-300 shrink-0 group-hover:translate-x-1 transition-transform" />
          </div>
        </a>
      </Link>
    </section>
  );
}

/* ────────── CATALOG (filterable, kept from original) ────────── */
function Catalog({ searchQuery }: { searchQuery: string }) {
  const [activeCategory, setActiveCategory] = useState<ProductCategory | "all">("all");
  const storageVer = useStorageVersion();
  const dynamicCats = React.useMemo(() => getCategories(), [storageVer]);

  const filtered = React.useMemo(() => {
    return getAllProducts().filter((p) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.publisher.toLowerCase().includes(q);
      const matchesCategory = activeCategory === "all" || p.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, activeCategory, storageVer]);

  return (
    <section className="mt-8" id="catalog">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-lg sm:text-xl font-black flex items-center gap-2">
          <Gamepad2 className="w-5 h-5 text-amber-300" />
          Semua Produk
        </h2>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveCategory("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition ${
              activeCategory === "all"
                ? "bg-amber-500/15 text-amber-200 border-amber-500/40"
                : "bg-card border-border/60 text-muted-foreground hover:border-amber-500/30"
            }`}
          >
            Semua
          </button>
          {dynamicCats.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border transition ${
                activeCategory === c.id
                  ? "bg-amber-500/15 text-amber-200 border-amber-500/40"
                  : "bg-card border-border/60 text-muted-foreground hover:border-amber-500/30"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      {filtered.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 rounded-2xl border border-dashed border-border/60 bg-card/40">
          <SearchIcon className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-bold">Produk tidak ditemukan</p>
          <p className="text-xs text-muted-foreground">Coba kata kunci atau kategori lain</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => setActiveCategory("all")}
          >
            Reset filter
          </Button>
        </div>
      )}
    </section>
  );
}

export default function Home() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [announceDismissed, setAnnounceDismissed] = useState(false);
  const storageVer = useStorageVersion();

  useEffect(() => {
    setAnnouncement(getAnnouncement());
  }, [storageVer]);

  return (
    <DashboardLayout
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
      searchPlaceholder={t("search_ph")}
    >
      {announcement && !announceDismissed && (
        <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 flex items-center gap-3">
          <Megaphone className="w-4 h-4 text-amber-300 shrink-0" />
          <p className="text-sm flex-1">{announcement}</p>
          <button onClick={() => setAnnounceDismissed(true)} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <WelcomeHero />
      <MyKeysCard />
      <PopularProducts />
      <ActivitySummary />
      <WhyChooseUs />
      <HelpSection />
    </DashboardLayout>
  );
}
