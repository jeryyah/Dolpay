import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  Zap, User, Lock, Eye, EyeOff, UserPlus, LogIn,
  ShieldCheck, Smartphone, AlertTriangle, Gift,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { CaptchaInput } from "@/components/captcha";
import { applyReferralCode } from "@/lib/extra-storage";
import { TGMonogram } from "@/components/brand/tg-monogram";

export default function Login() {
  const { login, register, user, isAdmin } = useAuth();
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<"login" | "register">("login");

  // Pre-fill referral from URL ?ref=CODE
  const [refCode, setRefCode] = useState("");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get("ref");
    if (r) { setRefCode(r.toUpperCase()); setMode("register"); }
  }, []);

  // Already logged in → redirect
  useEffect(() => {
    if (user) navigate(isAdmin ? "/admin" : "/");
  }, [user]);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [captchaOK, setCaptchaOK] = useState(false);

  // 2FA flow state
  const [need2FA, setNeed2FA] = useState(false);
  const [twoFACode, setTwoFACode] = useState("");

  // Duplicate device warning
  const [dupWarn, setDupWarn] = useState<string[] | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password.trim()) { setError("Username dan password wajib diisi"); return; }
    if (password.length < 4) { setError("Password minimal 4 karakter"); return; }
    if (!captchaOK) { setError("Selesaikan captcha terlebih dahulu"); return; }
    if (need2FA && !/^\d{6}$/.test(twoFACode)) { setError("Kode 2FA harus 6 digit"); return; }

    setLoading(true);
    await new Promise((r) => setTimeout(r, 350));

    if (mode === "login") {
      const res = login(username, password, need2FA ? { twoFACode } : undefined);
      if (!res.ok) {
        if (res.need2FA) { setNeed2FA(true); setError(res.reason || "Masukkan kode 2FA"); setLoading(false); return; }
        setError(res.reason || "Gagal login"); setLoading(false); return;
      }
      if (res.duplicateUsers && res.duplicateUsers.length > 0) {
        setDupWarn(res.duplicateUsers);
      }
    } else {
      const result = register(username, password);
      if (!result.ok) { setError(result.error || "Registrasi gagal"); setLoading(false); return; }
      // Apply referral if any
      if (refCode.trim()) {
        const u = JSON.parse(localStorage.getItem("pinz_session") || "null");
        if (u?.id) applyReferralCode(u.id, refCode.trim());
      }
    }
    setLoading(false);
    const savedUser = JSON.parse(localStorage.getItem("pinz_session") || "null");
    if (dupWarn) return; // wait for user to dismiss
    if (savedUser?.role === "admin" || savedUser?.role === "owner") navigate("/admin");
    else navigate("/");
  };

  // Dismiss duplicate-warning then redirect
  if (dupWarn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background noise-bg px-4">
        <div className="max-w-sm w-full bg-card border border-amber-500/40 rounded-2xl p-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <p className="font-extrabold text-lg mb-1">Perangkat Sudah Pernah Dipakai</p>
          <p className="text-xs text-muted-foreground mb-4">
            Akun lain di perangkat ini: <b>{dupWarn.map((u) => `@${u}`).join(", ")}</b>.
            Pastikan ini bukan multi-akun yang melanggar aturan.
          </p>
          <button
            onClick={() => {
              setDupWarn(null);
              const u = JSON.parse(localStorage.getItem("pinz_session") || "null");
              navigate(u?.role === "admin" || u?.role === "owner" ? "/admin" : "/");
            }}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm"
          >
            Saya Mengerti, Lanjutkan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background noise-bg px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <TGMonogram size={48} />
            <span className="font-black text-2xl tracking-tight text-gold-grad">
              TECHGEMING
            </span>
          </div>
          <p className="text-muted-foreground text-sm">Platform cheat & topup gaming terpercaya</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-xl shadow-black/30">
          <div className="flex mb-6 bg-muted/40 rounded-xl p-1 gap-1">
            <button
              onClick={() => { setMode("login"); setError(""); setNeed2FA(false); }}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${mode === "login" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <LogIn className="w-4 h-4 inline mr-1.5" />Login
            </button>
            <button
              onClick={() => { setMode("register"); setError(""); setNeed2FA(false); }}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${mode === "register" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <UserPlus className="w-4 h-4 inline mr-1.5" />Daftar
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setError(""); }}
                  placeholder="Masukkan username"
                  className="w-full pl-9 pr-4 py-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  placeholder="Masukkan password"
                  className="w-full pl-9 pr-10 py-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {mode === "register" && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Gift className="w-3.5 h-3.5" /> Kode Referral (opsional)
                </label>
                <input
                  value={refCode}
                  onChange={(e) => setRefCode(e.target.value.toUpperCase())}
                  placeholder="Mis: ABCD-1234"
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm font-mono uppercase focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {refCode && <p className="text-[10px] text-emerald-400">+Rp25.000 untuk kamu & teman saat daftar</p>}
              </div>
            )}

            {need2FA && (
              <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5" /> Kode 2FA (6 digit)
                </label>
                <input
                  value={twoFACode}
                  onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  inputMode="numeric"
                  className="w-full px-3 py-3 bg-background border border-primary/40 rounded-xl text-center font-mono text-xl font-black tracking-[0.4em] focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}

            <CaptchaInput onValid={setCaptchaOK} />

            {error && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 text-sm text-destructive flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !captchaOK}
              className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl transition-all hover:bg-primary/90 active:scale-98 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              {loading ? "Memproses..." : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  {mode === "login" ? (need2FA ? "Verifikasi 2FA" : "Masuk") : "Buat Akun"}
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          &copy; {new Date().getFullYear()} TECHGEMING. All rights reserved.
        </p>
      </div>
    </div>
  );
}
