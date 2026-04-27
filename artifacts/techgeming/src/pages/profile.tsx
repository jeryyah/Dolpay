import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft, Camera, Save, Mail, ShieldCheck, Lock, Trash2, Crown,
  Award, Medal, Sparkles, CheckCircle, ChevronRight, ShoppingBag, AlertTriangle,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  updateUserProfile, setUserPin, getUserLevel, getUserTotalSpend,
  getUserOrders,
} from "@/lib/storage";
import { formatCurrency } from "@/lib/utils";

const TIER_ICON: Record<string, React.ReactNode> = {
  Bronze: <Medal className="w-4 h-4" />,
  Silver: <Award className="w-4 h-4" />,
  Gold:   <Crown className="w-4 h-4" />,
  VIP:    <Sparkles className="w-4 h-4" />,
};

export default function Profile() {
  const { user, refresh, logout } = useAuth();
  const [, navigate] = useLocation();
  const [nickname, setNickname] = useState("");
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState("");
  const [avatar, setAvatar] = useState<string | undefined>(undefined);
  const [saved, setSaved] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // PIN state
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinErr, setPinErr] = useState<string | null>(null);
  const [pinSaved, setPinSaved] = useState(false);

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    setNickname(user.nickname || "");
    setBio(user.bio || "");
    setEmail(user.email || "");
    setAvatar(user.avatarBase64);
  }, [user]);

  if (!user) return null;

  const lvl = getUserLevel(user.id);
  const total = getUserTotalSpend(user.id);
  const ordersCount = getUserOrders(user.id).filter(
    (o) => o.status === "verified" || o.status === "paid",
  ).length;

  const onAvatarPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { alert("Max 2MB"); return; }
    const reader = new FileReader();
    reader.onloadend = () => setAvatar(reader.result as string);
    reader.readAsDataURL(f);
  };

  const handleSave = () => {
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setSaved("err:Email tidak valid");
      return;
    }
    updateUserProfile(user.id, {
      nickname: nickname.trim() || undefined,
      bio: bio.trim() || undefined,
      email: email.trim() || undefined,
      avatarBase64: avatar,
    });
    refresh?.();
    setSaved("ok");
    setTimeout(() => setSaved(null), 2200);
  };

  const handleSavePin = () => {
    setPinErr(null);
    if (!/^\d{4,6}$/.test(pin)) { setPinErr("PIN harus 4–6 digit angka."); return; }
    if (pin !== pinConfirm) { setPinErr("Konfirmasi PIN tidak cocok."); return; }
    setUserPin(user.id, pin);
    refresh?.();
    setPinSaved(true);
    setPin(""); setPinConfirm("");
    setTimeout(() => setPinSaved(false), 2200);
  };

  const handleRemovePin = () => {
    if (!confirm("Hapus PIN keamanan? Key akan langsung terlihat di history.")) return;
    setUserPin(user.id, null);
    refresh?.();
  };

  const progressPct = lvl.next
    ? Math.min(100, (total / (total + lvl.next.need)) * 100)
    : 100;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="container mx-auto px-4 h-14 flex items-center gap-3 max-w-3xl">
          <Link href="/">
            <button className="p-2 -ml-2 rounded-lg hover:bg-muted text-muted-foreground">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <h1 className="font-bold text-base">Profil Saya</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-5 max-w-3xl space-y-5">

        {/* Identity card */}
        <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-card">
          <div className={`h-24 bg-gradient-to-r ${lvl.gradient}`} />
          <div className="px-5 pb-5 -mt-12 relative">
            {/* Avatar */}
            <div className="flex items-end gap-4">
              <div className="relative">
                <div className="w-24 h-24 rounded-full ring-4 ring-card overflow-hidden bg-muted flex items-center justify-center text-2xl font-extrabold text-foreground">
                  {avatar
                    ? <img src={avatar} alt="" className="w-full h-full object-cover" />
                    : (nickname || user.username)[0]?.toUpperCase()}
                </div>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-primary-foreground border-2 border-card flex items-center justify-center hover:brightness-110"
                  title="Ganti foto"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
                <input ref={fileRef} type="file" accept="image/*" onChange={onAvatarPick} className="hidden" />
              </div>
              <div className="flex-1 min-w-0 pb-1">
                <p className="font-extrabold text-lg truncate">{nickname || user.username}</p>
                <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
              </div>
              <span className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white bg-gradient-to-r ${lvl.gradient} shadow`}>
                {TIER_ICON[lvl.tier]}{lvl.tier}
              </span>
            </div>

            {/* Tier progress */}
            <div className="mt-5 bg-muted/30 border border-border/60 rounded-xl p-3">
              <div className="flex items-center justify-between text-[11px] mb-1.5">
                <span className="text-muted-foreground">Total spend bulan ini</span>
                <span className="font-bold">{formatCurrency(total)}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className={`h-full bg-gradient-to-r ${lvl.gradient} transition-all`} style={{ width: `${progressPct}%` }} />
              </div>
              {lvl.next ? (
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  Tinggal <span className="text-foreground font-bold">{formatCurrency(lvl.next.need)}</span> lagi untuk naik ke <span className="text-foreground font-bold">{lvl.next.tier}</span>
                </p>
              ) : (
                <p className="text-[10px] text-fuchsia-400 mt-1.5 font-bold">⭐ Kamu sudah di tier tertinggi!</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="bg-muted/30 border border-border/60 rounded-xl p-3 text-center">
                <p className="text-xl font-extrabold">{ordersCount}</p>
                <p className="text-[10px] text-muted-foreground tracking-wider">PEMBELIAN</p>
              </div>
              <Link href="/leaderboard">
                <button className="w-full h-full bg-muted/30 border border-border/60 rounded-xl p-3 text-center hover:bg-muted/50 transition-all">
                  <p className="text-xl font-extrabold flex items-center justify-center gap-1">
                    <Crown className="w-4 h-4 text-yellow-400" /> Peringkat
                  </p>
                  <p className="text-[10px] text-muted-foreground tracking-wider">LIHAT LEADERBOARD</p>
                </button>
              </Link>
            </div>
          </div>
        </section>

        {/* Edit profile */}
        <section className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
          <p className="font-bold text-sm flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" /> Info Profil
          </p>

          <div>
            <label className="text-[10px] font-bold tracking-widest text-muted-foreground mb-1.5 block">NICKNAME</label>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={32}
              placeholder="Nama tampilan kamu"
              className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold tracking-widest text-muted-foreground mb-1.5 block">BIO</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={140}
              rows={3}
              placeholder="Tulis sesuatu tentang dirimu..."
              className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
            <p className="text-[10px] text-muted-foreground text-right mt-0.5">{bio.length}/140</p>
          </div>

          <div>
            <label className="text-[10px] font-bold tracking-widest text-muted-foreground mb-1.5 block flex items-center gap-1">
              <Mail className="w-3 h-3" /> EMAIL (untuk backup key)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="kamu@email.com"
              className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Dipakai untuk fitur "Backup Key ke Email" di history.
            </p>
          </div>

          <button
            onClick={handleSave}
            className="w-full py-3 bg-primary text-primary-foreground font-bold text-sm rounded-xl hover:brightness-110 flex items-center justify-center gap-2"
          >
            {saved === "ok" ? <><CheckCircle className="w-4 h-4" /> Tersimpan!</> : <><Save className="w-4 h-4" /> Simpan Perubahan</>}
          </button>
          {saved?.startsWith("err:") && (
            <p className="text-xs text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {saved.slice(4)}</p>
          )}
        </section>

        {/* PIN */}
        <section className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-bold text-sm flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary" /> PIN Keamanan Key
            </p>
            {user.pin && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/30">
                AKTIF
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Aktifkan PIN agar license key di history kamu tidak terlihat sebelum kamu input PIN. Mencegah orang lain melihat key kalau HP kamu dibuka.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold tracking-widest text-muted-foreground mb-1.5 block">PIN BARU (4–6 DIGIT)</label>
              <input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="••••"
                className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm font-mono tracking-widest focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold tracking-widest text-muted-foreground mb-1.5 block">KONFIRMASI PIN</label>
              <input
                type="password"
                inputMode="numeric"
                value={pinConfirm}
                onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="••••"
                className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm font-mono tracking-widest focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {pinErr && <p className="text-xs text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {pinErr}</p>}

          <div className="flex gap-2">
            <button
              onClick={handleSavePin}
              className="flex-1 py-2.5 bg-primary text-primary-foreground font-bold text-sm rounded-xl hover:brightness-110 flex items-center justify-center gap-2"
            >
              {pinSaved ? <><CheckCircle className="w-4 h-4" /> Tersimpan!</> : user.pin ? "Ganti PIN" : "Aktifkan PIN"}
            </button>
            {user.pin && (
              <button
                onClick={handleRemovePin}
                className="px-4 py-2.5 bg-destructive/10 border border-destructive/30 text-destructive font-bold text-sm rounded-xl hover:bg-destructive/20"
                title="Hapus PIN"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </section>

        {/* Quick links */}
        <section className="rounded-2xl border border-border/60 bg-card divide-y divide-border/60">
          <Link href="/history">
            <a className="flex items-center gap-3 px-5 py-4 hover:bg-muted/30">
              <div className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold">Riwayat Pembelian & Garansi</p>
                <p className="text-[11px] text-muted-foreground">Lihat key, klaim garansi, replace key</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </a>
          </Link>
          <Link href="/leaderboard">
            <a className="flex items-center gap-3 px-5 py-4 hover:bg-muted/30">
              <div className="w-9 h-9 rounded-xl bg-yellow-500/15 text-yellow-400 flex items-center justify-center">
                <Crown className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold">Leaderboard Top Buyer</p>
                <p className="text-[11px] text-muted-foreground">Top 3 dapat hadiah otomatis tiap bulan</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </a>
          </Link>
        </section>

        {/* Logout */}
        <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <button
            onClick={() => {
              if (!confirm("Yakin ingin keluar dari akun ini?")) return;
              logout();
              navigate("/login");
            }}
            className="w-full flex items-center justify-center gap-2 py-3 bg-destructive text-destructive-foreground font-bold text-sm rounded-xl hover:brightness-110 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Keluar dari Akun
          </button>
          <p className="text-[11px] text-muted-foreground text-center mt-2">
            Kamu akan diarahkan ke halaman login. Riwayat & key tersimpan aman.
          </p>
        </section>
      </main>
    </div>
  );
}
