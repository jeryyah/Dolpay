import React from "react";
import { Link, useLocation } from "wouter";
import {
  Home as HomeIcon,
  Package,
  Clock,
  Receipt,
  Users,
  Wrench,
  Settings,
  ShieldCheck,
  Crown,
  Sparkles,
  Award,
  Medal,
} from "lucide-react";
import { TGMonogram } from "@/components/brand/tg-monogram";
import { useAuth } from "@/lib/auth-context";
import { getUserLevel } from "@/lib/storage";

const NAV: { href: string; label: string; icon: React.ReactNode }[] = [
  { href: "/",              label: "Beranda",    icon: <HomeIcon className="w-[18px] h-[18px]" /> },
  { href: "/wishlist",      label: "Produk",     icon: <Package  className="w-[18px] h-[18px]" /> },
  { href: "/history",       label: "Riwayat",    icon: <Clock    className="w-[18px] h-[18px]" /> },
  { href: "/leaderboard",   label: "Transaksi",  icon: <Receipt  className="w-[18px] h-[18px]" /> },
  { href: "/referral",      label: "Afiliasi",   icon: <Users    className="w-[18px] h-[18px]" /> },
  { href: "/garansi",       label: "Tools",      icon: <Wrench   className="w-[18px] h-[18px]" /> },
  { href: "/profile",       label: "Pengaturan", icon: <Settings className="w-[18px] h-[18px]" /> },
];

const TIER_ICON: Record<string, React.ReactNode> = {
  Bronze: <Medal     className="w-3 h-3" />,
  Silver: <Award     className="w-3 h-3" />,
  Gold:   <Crown     className="w-3 h-3" />,
  VIP:    <Sparkles  className="w-3 h-3" />,
};

export function SidebarNav() {
  const [location] = useLocation();
  const { user, isAdmin, isOwner } = useAuth();
  const lvl = user ? getUserLevel(user.id) : null;

  const isActive = (href: string) =>
    href === "/" ? location === "/" : location.startsWith(href);

  return (
    <aside className="hidden lg:flex flex-col w-[230px] shrink-0 sticky top-0 h-screen border-r border-border/60 bg-[hsl(36_18%_4%)]/95 backdrop-blur-xl px-4 py-5 z-30">
      {/* Brand */}
      <Link href="/">
        <a className="flex items-center gap-3 mb-6 group">
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl blur-md bg-amber-500/30 group-hover:bg-amber-400/50 transition" />
            <TGMonogram size={44} className="relative" />
          </div>
          <div className="leading-tight">
            <p className="font-extrabold text-[15px] tracking-wide text-gold-grad">TECHGEMING</p>
            <p className="text-[10px] text-muted-foreground tracking-[0.2em] font-semibold">STORE</p>
          </div>
        </a>
      </Link>

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-1">
        {NAV.map((item) => {
          const active = isActive(item.href);
          return (
            <Link key={item.href} href={item.href}>
              <a
                className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all
                  ${active
                    ? "bg-gradient-to-r from-amber-500/15 via-amber-500/8 to-transparent text-amber-200 shadow-[inset_0_0_0_1px_rgba(242,194,92,0.25)]"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-gradient-to-b from-amber-300 to-amber-600" />
                )}
                <span className={active ? "text-amber-300" : "text-foreground/70 group-hover:text-amber-200"}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </a>
            </Link>
          );
        })}

        {(isAdmin || isOwner) && (
          <Link href="/admin">
            <a className="mt-2 flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/15">
              <ShieldCheck className="w-[18px] h-[18px]" />
              Admin Panel
            </a>
          </Link>
        )}
      </nav>

      {/* User badge */}
      <div className="mt-4 rounded-2xl border border-border/60 bg-[hsl(36_16%_7%)] p-3 flex items-center gap-3">
        <div className="relative w-9 h-9 rounded-full overflow-hidden bg-muted flex items-center justify-center text-xs font-extrabold border border-amber-500/30 shrink-0">
          {user?.avatarBase64
            ? <img src={user.avatarBase64} alt="" className="w-full h-full object-cover" />
            : (user?.nickname || user?.username || "T")[0]?.toUpperCase()}
          <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[hsl(36_16%_7%)]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-bold truncate flex items-center gap-1">
            {user ? (user.nickname || user.username) : "TECHGEMING Store"}
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
          </p>
          {lvl ? (
            <span className={`inline-flex items-center gap-1 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-gradient-to-r ${lvl.gradient} text-black`}>
              {TIER_ICON[lvl.tier]} {lvl.tier}
            </span>
          ) : (
            <p className="text-[10px] text-muted-foreground">Aman · Cepat · Terpercaya</p>
          )}
        </div>
      </div>
    </aside>
  );
}

/** Mobile bottom-bar nav (visible < lg). */
export function MobileBottomNav() {
  const [location] = useLocation();
  const items = NAV.slice(0, 5);
  const isActive = (href: string) =>
    href === "/" ? location === "/" : location.startsWith(href);

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border/60 bg-[hsl(36_18%_4%)]/95 backdrop-blur-xl px-2 py-1.5">
      <div className="flex items-center justify-around">
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <Link key={item.href} href={item.href}>
              <a className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg ${active ? "text-amber-300" : "text-muted-foreground"}`}>
                <span>{item.icon}</span>
                <span className="text-[10px] font-bold">{item.label}</span>
              </a>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
