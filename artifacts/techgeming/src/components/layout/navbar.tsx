import React from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Zap, History, MessageCircle, HelpCircle, Code, LogOut, ShieldCheck, User as UserIcon, Crown, Trophy, Languages, ArrowLeft, Heart, Gift } from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";
import i18n from "@/lib/i18n";
import { useTranslation } from "react-i18next";

function LangToggle() {
  const { i18n: i } = useTranslation();
  const cur = (i.language || "id").slice(0, 2);
  const next = cur === "id" ? "en" : "id";
  return (
    <button
      onClick={() => i.changeLanguage(next)}
      className="hidden sm:flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-foreground border border-border/60 rounded-lg px-2 py-1.5 hover:bg-muted"
      title={`Bahasa: ${cur.toUpperCase()} → ${next.toUpperCase()}`}
    >
      <Languages className="w-3.5 h-3.5" />
      {cur.toUpperCase()}
    </button>
  );
}

export function Navbar() {
  const { user, logout, isAdmin, isOwner } = useAuth();
  const [location, navigate] = useLocation();
  const showBack = location !== "/" && location !== "";

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    } else {
      navigate("/");
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {showBack && (
            <button
              onClick={handleBack}
              aria-label="Kembali"
              className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl bg-muted/40 border border-border/60 text-foreground/90 hover:bg-muted hover:border-primary/40 active:scale-95 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer min-w-0">
              <div className="bg-primary text-primary-foreground p-1.5 rounded-lg shrink-0">
                <Zap className="h-4 w-4" />
              </div>
              <span className="font-bold tracking-tight truncate">TECHGEMING</span>
            </div>
          </Link>
        </div>
        <nav className="hidden md:flex items-center gap-1 text-sm">
          <Link href="/history"><a className="px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all flex items-center gap-1.5"><History className="w-4 h-4" />Riwayat</a></Link>
          <Link href="/wishlist"><a className="px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all flex items-center gap-1.5"><Heart className="w-4 h-4" />Wishlist</a></Link>
          <Link href="/leaderboard"><a className="px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all flex items-center gap-1.5"><Trophy className="w-4 h-4" />Top Buyer</a></Link>
          <Link href="/referral"><a className="px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all flex items-center gap-1.5"><Gift className="w-4 h-4" />Referral</a></Link>
          <Link href="/chat"><a className="px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all flex items-center gap-1.5"><MessageCircle className="w-4 h-4" />Chat</a></Link>
          <Link href="/faq"><a className="px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all flex items-center gap-1.5"><HelpCircle className="w-4 h-4" />FAQ</a></Link>
          <Link href="/developer"><a className="px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all flex items-center gap-1.5"><Code className="w-4 h-4" />Developer</a></Link>
        </nav>
        <div className="flex items-center gap-2">
          {user && <NotificationBell />}
          <LangToggle />
          {(isAdmin || isOwner) && (
            <Link href="/admin">
              <button className="text-xs font-bold text-primary border border-primary/30 px-2.5 py-1.5 rounded-lg hover:bg-primary/10 transition-all flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />Admin
              </button>
            </Link>
          )}
          {user ? (
            <>
              <Link href="/profile">
                <button className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg hover:bg-muted text-foreground" title="Profil">
                  <span className="w-7 h-7 rounded-full overflow-hidden bg-muted flex items-center justify-center text-[11px] font-extrabold border border-border/60">
                    {user.avatarBase64
                      ? <img src={user.avatarBase64} alt="" className="w-full h-full object-cover" />
                      : (user.nickname || user.username)[0]?.toUpperCase()}
                  </span>
                  <span className="hidden sm:inline font-bold">{user.nickname || user.username}</span>
                </button>
              </Link>
              <button
                onClick={() => { logout(); navigate("/login"); }}
                className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 px-2 py-1.5"
                title="Logout"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <Link href="/login">
              <button className="text-xs font-bold bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:brightness-110 flex items-center gap-1">
                <UserIcon className="w-3.5 h-3.5" />Login
              </button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-background py-8 mt-12">
      <div className="container mx-auto px-4 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="bg-primary text-primary-foreground p-1.5 rounded-lg">
            <Zap className="h-4 w-4" />
          </div>
          <span className="font-bold tracking-tight">TECHGEMING</span>
        </div>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} TECHGEMING · Topup digital paling kilat di Indonesia
        </p>
        <div className="flex justify-center gap-4 mt-3 text-xs text-muted-foreground">
          <Link href="/contact"><a className="hover:text-foreground">Kontak</a></Link>
          <Link href="/faq"><a className="hover:text-foreground">FAQ</a></Link>
          <Link href="/developer"><a className="hover:text-foreground">Developer</a></Link>
        </div>
      </div>
    </footer>
  );
}
