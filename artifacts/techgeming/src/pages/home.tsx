import React, { useState, useEffect } from "react";
import { Link } from "wouter";
import { Navbar, Footer } from "@/components/layout/navbar";
import { HelpBar } from "@/components/help-bar";
import { BuyerActivity } from "@/components/buyer-activity";
import { type ProductCategory } from "@/data/products";
import { getAllProducts, getCategories } from "@/lib/storage";
import { ProductCard } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Gamepad2, Gift, Zap, SearchIcon, Megaphone, X,
  Shield, RotateCcw, Mail, Lock, Trophy, Crown, Award, Medal, Sparkles,
  ShoppingBag, ChevronRight, UserPlus, Heart, Bell, MessageCircle, Flame,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { getAnnouncement, getUserLevel, getUserOrders, warrantyInfo } from "@/lib/storage";
import { useStorageVersion } from "@/lib/use-live-storage";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency } from "@/lib/utils";
import { getUserExt, getWishlist, getUserNotifs } from "@/lib/extra-storage";

const TIER_ICON: Record<string, React.ReactNode> = {
  Bronze: <Medal className="w-3.5 h-3.5" />,
  Silver: <Award className="w-3.5 h-3.5" />,
  Gold:   <Crown className="w-3.5 h-3.5" />,
  VIP:    <Sparkles className="w-3.5 h-3.5" />,
};

type Badge = {
  label: string;          // text shown inside the bubble (e.g. "3", "!", "•")
  tone: "danger" | "warning" | "info" | "success";
  pulse?: boolean;
  title?: string;         // tooltip/aria
};

type Tile = {
  href: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
  ring: string;
  iconBg: string;
  iconFg: string;
  badge?: Badge;
};

const BASE_TILES: Tile[] = [
  { href: "/garansi",       title: "Garansi Key",   desc: "30 hari · auto klaim",   icon: <Shield className="w-5 h-5" />,    ring: "from-emerald-500/40 to-emerald-500/0",  iconBg: "bg-emerald-500/15", iconFg: "text-emerald-300" },
  { href: "/replace-key",   title: "Replace Key",   desc: "1× saat garansi",        icon: <RotateCcw className="w-5 h-5" />, ring: "from-amber-500/40 to-amber-500/0",      iconBg: "bg-amber-500/15",   iconFg: "text-amber-300"   },
  { href: "/backup-email",  title: "Backup Email",  desc: "Kirim key ulang",        icon: <Mail className="w-5 h-5" />,      ring: "from-sky-500/40 to-sky-500/0",          iconBg: "bg-sky-500/15",     iconFg: "text-sky-300"     },
  { href: "/wishlist",      title: "Wishlist",      desc: "Produk favoritmu",       icon: <Heart className="w-5 h-5" />,     ring: "from-rose-500/40 to-rose-500/0",        iconBg: "bg-rose-500/15",    iconFg: "text-rose-300"    },
  { href: "/referral",      title: "Referral",      desc: "Ajak teman, dapat bonus",icon: <Gift className="w-5 h-5" />,      ring: "from-violet-500/40 to-violet-500/0",    iconBg: "bg-violet-500/15",  iconFg: "text-violet-300"  },
  { href: "/chat",          title: "Live Chat",     desc: "Tanya admin langsung",   icon: <MessageCircle className="w-5 h-5"/>,ring: "from-cyan-500/40 to-cyan-500/0",       iconBg: "bg-cyan-500/15",    iconFg: "text-cyan-300"    },
  { href: "/notifications", title: "Notifikasi",    desc: "Update terbaru",         icon: <Bell className="w-5 h-5" />,      ring: "from-orange-500/40 to-orange-500/0",    iconBg: "bg-orange-500/15",  iconFg: "text-orange-300"  },
  { href: "/leaderboard",   title: "Top Buyer",     desc: "Hadiah bulanan",         icon: <Trophy className="w-5 h-5" />,    ring: "from-yellow-500/40 to-yellow-500/0",    iconBg: "bg-yellow-500/15",  iconFg: "text-yellow-300"  },
  { href: "/pin",           title: "PIN Keamanan",  desc: "Kunci key dengan PIN 4–6 digit", icon: <Lock className="w-5 h-5" />,        ring: "from-fuchsia-500/40 to-fuchsia-500/0", iconBg: "bg-fuchsia-500/15", iconFg: "text-fuchsia-300" },
  { href: "/history",       title: "Riwayat",       desc: "Lihat semua key & status",   icon: <ShoppingBag className="w-5 h-5" />, ring: "from-primary/50 to-primary/0",         iconBg: "bg-primary/15",     iconFg: "text-primary"     },
];

const BADGE_TONE: Record<Badge["tone"], string> = {
  danger:  "bg-rose-500 text-white ring-2 ring-rose-500/30 shadow-lg shadow-rose-500/30",
  warning: "bg-amber-400 text-black ring-2 ring-amber-400/30 shadow-lg shadow-amber-500/30",
  info:    "bg-sky-400  text-black ring-2 ring-sky-400/30  shadow-lg shadow-sky-500/30",
  success: "bg-emerald-400 text-black ring-2 ring-emerald-400/30 shadow-lg shadow-emerald-500/30",
};

function useTileBadges(): Record<string, Badge | undefined> {
  const { user } = useAuth();
  if (!user) return {};

  const orders   = getUserOrders(user.id);
  const verified = orders.filter((o) => (o.status === "verified" || o.status === "paid") && o.key);

  // Garansi: jumlah garansi aktif yang habis dalam ≤ 7 hari
  const expiringSoon = verified.filter((o) => {
    if (o.warrantyClaimedAt) return false;
    const w = warrantyInfo(o);
    return w.active && w.daysLeft <= 7;
  }).length;

  // Replace Key: jumlah order yang masih bisa di-replace
  const replaceable = verified.filter((o) => {
    if (o.replacedAt) return false;
    const w = warrantyInfo(o);
    return w.active;
  }).length;

  // Backup Email: jumlah key yang belum pernah dikirim ke email
  const neverBackedUp = verified.filter((o) => !o.backupSentAt).length;

  // PIN: belum diset
  const pinMissing = !user.pin;

  // Riwayat: order pending / pending_verify / cancelled (perlu perhatian)
  const needsAttention = orders.filter(
    (o) => o.status === "pending" || o.status === "pending_verify",
  ).length;

  const wishCount = getWishlist(user.id).length;
  const unreadNotif = getUserNotifs(user.id).filter((n: any) => !n.read).length;

  return {
    "/garansi":      expiringSoon  > 0 ? { label: String(expiringSoon),  tone: "warning", pulse: true, title: `${expiringSoon} garansi habis ≤ 7 hari` } : undefined,
    "/replace-key":  replaceable   > 0 ? { label: String(replaceable),   tone: "info",                  title: `${replaceable} order bisa di-replace` } : undefined,
    "/backup-email": neverBackedUp > 0 ? { label: String(neverBackedUp), tone: "info",                  title: `${neverBackedUp} key belum di-backup` } : undefined,
    "/pin":          pinMissing        ? { label: "!",                   tone: "danger",  pulse: true, title: "PIN keamanan belum aktif" } : undefined,
    "/history":      needsAttention> 0 ? { label: String(needsAttention),tone: "danger",  pulse: true, title: `${needsAttention} order menunggu` } : undefined,
    "/wishlist":     wishCount     > 0 ? { label: String(wishCount),     tone: "info",                  title: `${wishCount} produk di wishlist` } : undefined,
    "/notifications":unreadNotif   > 0 ? { label: String(unreadNotif),   tone: "danger",  pulse: true, title: `${unreadNotif} notifikasi baru` } : undefined,
  };
}

function StreakBanner() {
  const { user } = useAuth();
  if (!user) return null;
  const ext = getUserExt(user.id);
  const streakRaw = (ext as any)?.streak;
  const streak = typeof streakRaw === "number" ? streakRaw : Number(streakRaw?.current) || 0;
  if (streak < 1) return null;
  const next7 = Math.ceil(streak / 7) * 7;
  const toNext = next7 - streak;
  return (
    <div className="container mx-auto px-4 mt-3 relative z-10">
      <div className="relative overflow-hidden rounded-2xl border border-orange-500/30 bg-gradient-to-r from-orange-600/20 via-amber-500/10 to-rose-500/20 p-3 sm:p-4 flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-orange-500/30 text-orange-300 flex items-center justify-center shrink-0 animate-pulse">
          <Flame className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-extrabold leading-tight">
            🔥 Login Streak: <span className="text-orange-300">{streak} hari</span> berturut-turut!
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {toNext === 0 ? "Cek notifikasi — bonus streak masuk!" : `${toNext} hari lagi untuk bonus streak berikutnya (Rp${(next7 * 1000).toLocaleString("id-ID")})`}
          </p>
        </div>
      </div>
    </div>
  );
}

function FeatureHero() {
  const { user } = useAuth();
  const lvl = user ? getUserLevel(user.id) : null;
  const orderCount = user
    ? getUserOrders(user.id).filter((o) => o.status === "verified" || o.status === "paid").length
    : 0;
  const badges = useTileBadges();

  // Solid card surface — no transparency, so aurora can't bleed through
  const SURFACE = "bg-[hsl(230_22%_9%)]";

  return (
    <section className="container mx-auto px-4 pt-6 pb-2 relative z-10">
      {/* Status / login card */}
      {user ? (
        <div className={`relative overflow-hidden rounded-2xl border border-white/5 ${SURFACE} p-4 sm:p-5 mb-4`}>
          <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
          <div className="relative flex items-center gap-3 sm:gap-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl overflow-hidden bg-[hsl(230_22%_14%)] flex items-center justify-center text-base sm:text-lg font-extrabold border border-white/10 shrink-0">
              {user.avatarBase64
                ? <img src={user.avatarBase64} alt="" className="w-full h-full object-cover" />
                : (user.nickname || user.username)[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted-foreground">Selamat datang kembali,</p>
              <p className="font-extrabold truncate">@{user.nickname || user.username}</p>
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                {lvl && (
                  <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-gradient-to-r ${lvl.gradient} text-black shadow-md`}>
                    {TIER_ICON[lvl.tier]} {lvl.tier}
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground">
                  {orderCount} pembelian · Total {lvl ? formatCurrency(lvl.totalSpend) : "Rp 0"}
                </span>
              </div>
            </div>
            <Link href="/profile">
              <a className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-primary border border-primary/30 px-3 py-1.5 rounded-lg hover:bg-primary/10">
                Profil <ChevronRight className="w-3.5 h-3.5" />
              </a>
            </Link>
          </div>
          {lvl?.next && (
            <div className="relative mt-3">
              <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                <span>Menuju {lvl.next.tier}</span>
                <span>Belanja {formatCurrency(lvl.next.need)} lagi</span>
              </div>
              <div className="h-1.5 bg-[hsl(230_22%_14%)] rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${lvl.gradient} transition-all`}
                  style={{ width: `${Math.min(100, (lvl.totalSpend / (lvl.totalSpend + lvl.next.need)) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className={`relative overflow-hidden rounded-2xl border border-primary/40 ${SURFACE} p-4 sm:p-5 mb-4 flex items-center gap-3`}>
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-primary/25 blur-3xl pointer-events-none" />
          <div className="relative w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center shrink-0">
            <UserPlus className="w-5 h-5" />
          </div>
          <div className="relative flex-1 min-w-0">
            <p className="font-bold text-sm">Login dulu untuk akses semua fitur</p>
            <p className="text-[11px] text-muted-foreground">Garansi key, replace, backup email & leaderboard.</p>
          </div>
          <Link href="/login">
            <a className="relative text-xs font-extrabold bg-primary text-primary-foreground px-3 py-2 rounded-xl hover:brightness-110 shrink-0">Masuk</a>
          </Link>
        </div>
      )}

      {/* Round icon menu — Gojek / Shopee style */}
      <div className={`relative overflow-hidden rounded-2xl ${SURFACE} border border-white/5 px-2 py-4`}>
        <div className="grid grid-cols-5 sm:grid-cols-6 gap-y-4">
          {BASE_TILES.map((t, i) => {
            const b = badges[t.href];
            return (
              <Link key={i} href={t.href}>
                <a className="group flex flex-col items-center gap-1.5 px-1" title={b?.title}>
                  <div className={`relative w-12 h-12 rounded-2xl ${t.iconBg} ${t.iconFg} flex items-center justify-center transition-transform group-active:scale-90 group-hover:scale-105`}>
                    {t.icon}
                    {b && (
                      <span
                        aria-label={b.title || b.label}
                        className={`absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-extrabold flex items-center justify-center leading-none ${BADGE_TONE[b.tone]} ${b.pulse ? "animate-pulse" : ""}`}
                      >
                        {b.label}
                      </span>
                    )}
                  </div>
                  <p className="text-[10.5px] font-semibold text-center leading-tight text-foreground/90 line-clamp-2">{t.title}</p>
                </a>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<ProductCategory | "all">("all");
  const [announcement, setAnnouncement] = useState("");
  const [announceDismissed, setAnnounceDismissed] = useState(false);
  const { t } = useTranslation();

  // Re-render real-time setiap kali admin ubah pengumuman / kategori / harga.
  const storageVer = useStorageVersion();

  useEffect(() => {
    setAnnouncement(getAnnouncement());
  }, [storageVer]);

  const dynamicCats = React.useMemo(() => getCategories(), [storageVer]);
  const CATEGORIES: { id: ProductCategory | "all"; label: string; icon: React.ReactNode }[] = [
    { id: "all", label: t("cat_all"), icon: <Zap className="w-4 h-4" /> },
    ...dynamicCats.map((c) => ({
      id: c.id,
      label: c.label,
      icon: c.id === "voucher" ? <Gift className="w-4 h-4" /> : <Gamepad2 className="w-4 h-4" />,
    })),
  ];

  const filteredProducts = getAllProducts().filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.publisher.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === "all" || p.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen flex flex-col noise-bg">
      <Navbar />
      {announcement && !announceDismissed && (
        <div className="bg-primary/10 border-b border-primary/30 px-4 py-2.5 flex items-center gap-3">
          <Megaphone className="w-4 h-4 text-primary shrink-0" />
          <p className="text-sm text-foreground flex-1">{announcement}</p>
          <button onClick={() => setAnnounceDismissed(true)} className="text-muted-foreground hover:text-foreground shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      <main className="flex-1">
        <StreakBanner />
        <FeatureHero />
        <section className="pt-6 pb-16 bg-background relative" id="catalog">
          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
              <div>
                <h2 className="text-3xl font-bold mb-2 flex items-center gap-2">
                  <Gamepad2 className="w-8 h-8 text-primary" />
                  {t("catalog_title")}
                </h2>
                <p className="text-muted-foreground">{t("catalog_sub")}</p>
              </div>

              <div className="w-full md:w-[300px] relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input 
                  placeholder={t("catalog_search")}
                  className="pl-10 h-12 bg-muted/30 border-border"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {filteredProducts.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="text-center py-20 bg-muted/10 rounded-2xl border border-border border-dashed">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <SearchIcon className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-bold mb-2">{t("not_found_title")}</h3>
                <p className="text-muted-foreground">{t("not_found_sub")}</p>
                <Button 
                  variant="outline" 
                  className="mt-6"
                  onClick={() => {
                    setSearchQuery("");
                    setActiveCategory("all");
                  }}
                >
                  {t("reset_filter")}
                </Button>
              </div>
            )}
          </div>
        </section>
      </main>

      <BuyerActivity />
      <Footer />
      <HelpBar />
    </div>
  );
}
