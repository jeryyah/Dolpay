import React from "react";
import { useLocation } from "wouter";
import { Search as SearchIcon } from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";
import { useAuth } from "@/lib/auth-context";
import { TGMonogram } from "@/components/brand/tg-monogram";
import { Link } from "wouter";

interface TopbarProps {
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
}

export function Topbar({ searchValue, onSearchChange, searchPlaceholder = "Cari cheat, game, tools..." }: TopbarProps) {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-[hsl(36_18%_4%)]/85 backdrop-blur-xl px-4 sm:px-6 py-3 flex items-center gap-3">
      {/* Mobile brand */}
      <Link href="/">
        <a className="lg:hidden flex items-center gap-2 shrink-0">
          <TGMonogram size={32} />
          <span className="font-extrabold text-sm text-gold-grad">TECHGEMING</span>
        </a>
      </Link>

      {/* Search */}
      <div className="flex-1 max-w-2xl mx-auto relative">
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          value={searchValue ?? ""}
          onChange={(e) => onSearchChange?.(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full h-11 rounded-2xl bg-[hsl(36_16%_8%)] border border-border/60 pl-11 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-amber-500/50 focus:shadow-[0_0_0_3px_rgba(242,194,92,0.12)] transition"
        />
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {user && (
          <div className="rounded-full border border-border/60 bg-[hsl(36_16%_8%)] hover:border-amber-500/40">
            <NotificationBell />
          </div>
        )}
        {!user && (
          <button
            onClick={() => navigate("/login")}
            className="text-xs font-extrabold bg-gold-grad text-black px-4 py-2 rounded-xl hover:brightness-110"
          >
            Masuk
          </button>
        )}
      </div>
    </header>
  );
}
