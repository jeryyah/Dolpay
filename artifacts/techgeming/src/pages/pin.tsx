import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft, Lock, Trash2, ShieldCheck, AlertTriangle, CheckCircle2, EyeOff, Eye,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { setUserPin } from "@/lib/storage";

export default function PinPage() {
  const { user, refresh } = useAuth();
  const [, navigate] = useLocation();
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  if (!user) { navigate("/login"); return null; }

  const handleSave = () => {
    setErr(null); setOk(false);
    if (!/^\d{4,6}$/.test(pin)) { setErr("PIN harus 4–6 digit angka."); return; }
    if (pin !== pinConfirm) { setErr("Konfirmasi PIN tidak cocok."); return; }
    setUserPin(user.id, pin);
    refresh?.();
    setPin(""); setPinConfirm("");
    setOk(true);
    setTimeout(() => setOk(false), 2500);
  };

  const handleRemove = () => {
    if (!confirm("Hapus PIN keamanan? Setelah ini license key di history akan langsung terlihat tanpa PIN.")) return;
    setUserPin(user.id, null);
    refresh?.();
    setOk(true);
    setTimeout(() => setOk(false), 2500);
  };

  // Visual representation of PIN dots
  const pinDots = Array.from({ length: 6 }).map((_, i) => i < pin.length);

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="container mx-auto px-4 h-14 flex items-center gap-3 max-w-3xl">
          <Link href="/">
            <button className="p-2 -ml-2 rounded-lg hover:bg-muted text-muted-foreground">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-fuchsia-500/15 text-fuchsia-300 flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <h1 className="font-bold text-base">PIN Keamanan</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-5 max-w-3xl space-y-5">
        {/* Hero */}
        <section className="rounded-2xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/15 via-fuchsia-500/5 to-transparent p-6 relative overflow-hidden text-center">
          <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-fuchsia-500/20 blur-3xl pointer-events-none" />
          <div className="relative">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-fuchsia-500/20 text-fuchsia-300 flex items-center justify-center mb-3">
              <Lock className="w-7 h-7" />
            </div>
            <p className="font-extrabold text-xl">{user.pin ? "PIN Aktif" : "PIN Belum Diset"}</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
              {user.pin
                ? "License key di Riwayat tertutup hingga PIN dimasukkan."
                : "Aktifkan PIN agar license key di Riwayat tidak terlihat sebelum kamu input PIN."}
            </p>

            {user.pin && (
              <span className="inline-flex items-center gap-1 mt-3 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                <ShieldCheck className="w-3 h-3" /> PERLINDUNGAN AKTIF
              </span>
            )}
          </div>
        </section>

        {/* PIN Form */}
        <section className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-bold text-sm">{user.pin ? "Ganti PIN" : "Buat PIN Baru"}</p>
            <button
              onClick={() => setShow((s) => !s)}
              className="text-[11px] font-bold inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
            >
              {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {show ? "Sembunyikan" : "Tampilkan"}
            </button>
          </div>

          {/* Visual dots preview */}
          <div className="flex items-center justify-center gap-2 py-2">
            {pinDots.map((filled, i) => (
              <div
                key={i}
                className={`w-3.5 h-3.5 rounded-full transition-all ${
                  filled ? "bg-fuchsia-400 scale-110" : "bg-muted border border-border"
                }`}
              />
            ))}
          </div>

          <div>
            <label className="text-[10px] font-bold tracking-widest text-muted-foreground mb-1.5 block">PIN BARU (4–6 DIGIT)</label>
            <input
              type={show ? "text" : "password"}
              inputMode="numeric"
              autoComplete="new-password"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="••••"
              className="w-full bg-background border border-border rounded-xl px-3 py-3 text-center text-lg font-mono tracking-[0.5em] focus:outline-none focus:ring-1 focus:ring-fuchsia-500/50"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold tracking-widest text-muted-foreground mb-1.5 block">KONFIRMASI PIN</label>
            <input
              type={show ? "text" : "password"}
              inputMode="numeric"
              autoComplete="new-password"
              value={pinConfirm}
              onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="••••"
              className="w-full bg-background border border-border rounded-xl px-3 py-3 text-center text-lg font-mono tracking-[0.5em] focus:outline-none focus:ring-1 focus:ring-fuchsia-500/50"
            />
          </div>

          {err && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {err}
            </p>
          )}
          {ok && (
            <p className="text-xs text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Tersimpan!
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex-1 py-3 bg-fuchsia-500 text-white font-extrabold text-sm rounded-xl hover:brightness-110 flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              {user.pin ? "Ganti PIN" : "Aktifkan PIN"}
            </button>
            {user.pin && (
              <button
                onClick={handleRemove}
                className="px-4 py-3 bg-destructive/10 border border-destructive/30 text-destructive font-bold text-sm rounded-xl hover:bg-destructive/20"
                title="Hapus PIN"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </section>

        {/* Tips */}
        <section className="rounded-2xl border border-border/60 bg-card p-5 space-y-2">
          <p className="font-bold text-sm flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" /> Tips Keamanan
          </p>
          <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-5">
            <li>Gunakan kombinasi yang sulit ditebak (hindari 1234, tanggal lahir).</li>
            <li>Jangan bagikan PIN ke siapa pun, termasuk admin TECHGEMING.</li>
            <li>PIN hanya kamu sendiri yang tahu — jika lupa, hubungi admin untuk reset.</li>
            <li>Ganti PIN secara berkala untuk keamanan maksimal.</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
