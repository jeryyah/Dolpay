import React from "react";
import { Link, useLocation } from "wouter";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export function AdminModeBar() {
  const { user, isAdmin, isOwner } = useAuth();
  const [location] = useLocation();

  if (!user || (!isAdmin && !isOwner)) return null;
  if (location === "/admin" || location.startsWith("/admin/")) return null;
  if (location === "/login") return null;

  return (
    <>
      {/* Top inline strip */}
      <div className="sticky top-0 z-[60] w-full bg-gradient-to-r from-amber-500/95 via-orange-500/95 to-pink-500/95 text-black shadow-lg shadow-orange-500/30 backdrop-blur">
        <div className="container mx-auto px-4 h-9 flex items-center justify-between text-xs sm:text-sm font-semibold">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            <span className="hidden sm:inline">Mode Admin aktif —</span>
            <span className="sm:hidden">Admin —</span>
            <span className="opacity-80">@{user.username}</span>
          </div>
          <Link href="/admin">
            <a className="inline-flex items-center gap-1.5 bg-black/85 text-white px-3 py-1 rounded-full hover:bg-black transition-all">
              <ArrowLeft className="w-3.5 h-3.5" />
              Kembali ke Panel Admin
            </a>
          </Link>
        </div>
      </div>

      {/* Floating bottom-right action (mobile-friendly) */}
      <Link href="/admin">
        <a
          className="fixed bottom-5 right-5 z-[60] inline-flex items-center gap-2 px-4 py-3 rounded-full
                     bg-gradient-to-r from-orange-500 to-pink-500 text-black font-bold text-sm
                     shadow-2xl shadow-orange-500/40 hover:scale-105 active:scale-95 transition-transform"
          title="Kembali ke Panel Admin"
        >
          <ShieldCheck className="w-4 h-4" />
          <span className="hidden sm:inline">Panel Admin</span>
        </a>
      </Link>
    </>
  );
}
