import React, { createContext, useContext, useState, useEffect } from "react";
import {
  type User, getSession, setSession, clearSession, loginUser, registerUser,
  generateSessionToken, setSessionToken, clearSessionToken, getSessionToken,
} from "./storage";
import {
  recordLogin, attachDeviceToUser, findUsersByDevice, getDeviceId,
  getUserExt, stopImpersonate, isImpersonating, getImpersonateOrigin,
  pushActivity, pushNotif, verify2FACode,
} from "./extra-storage";

interface LoginExtra {
  /** Required if user has 2FA enabled (owner). */
  twoFACode?: string;
}
interface LoginResult {
  ok: boolean;
  reason?: string;
  /** True jika butuh kode 2FA. */
  need2FA?: boolean;
  /** Daftar user lain yang share device — peringatan duplicate. */
  duplicateUsers?: string[];
  /** Streak baru setelah login. */
  streak?: number;
  bonus?: number;
}

interface AuthContextValue {
  user: User | null;
  sessionToken: string | null;
  login: (username: string, password: string, extra?: LoginExtra) => LoginResult;
  register: (username: string, password: string) => { ok: boolean; error?: string };
  logout: () => void;
  isAdmin: boolean;
  isOwner: boolean;
  refresh: () => void;
  // Impersonation
  isImpersonating: boolean;
  endImpersonation: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getSession());
  const [sessionToken, setSessionTokenState] = useState<string | null>(() => getSessionToken());
  const [impersonating, setImpersonating] = useState<boolean>(() => isImpersonating());

  // Listen for impersonation changes (cross-tab)
  useEffect(() => {
    const onStorage = () => setImpersonating(isImpersonating());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const login = (username: string, password: string, extra?: LoginExtra): LoginResult => {
    const u = loginUser(username, password);
    if (!u) return { ok: false, reason: "Username atau password salah" };

    // Banned check
    const ext = getUserExt(u.id);
    if ((ext as any)?.banned) {
      pushActivity("auth", `Login DITOLAK (banned): ${u.username}`);
      return { ok: false, reason: `Akun dibanned. Alasan: ${(ext as any).banReason || "—"}` };
    }

    // 2FA check (only owner)
    if (u.role === "owner" && (ext as any)?.twoFA) {
      if (!extra?.twoFACode) {
        return { ok: false, need2FA: true, reason: "Masukkan kode 2FA" };
      }
      if (!verify2FACode(extra.twoFACode)) {
        pushActivity("auth", `2FA salah untuk ${u.username}`);
        return { ok: false, need2FA: true, reason: "Kode 2FA salah atau kadaluarsa" };
      }
    }

    // Attach device & detect duplicates
    attachDeviceToUser(u.id);
    const dupUsers = findUsersByDevice(getDeviceId(), u.id).map((x) => x.username);
    if (dupUsers.length > 0) {
      pushActivity("auth", `Duplicate device terdeteksi: ${u.username} ↔ ${dupUsers.join(", ")}`);
    }

    // Daily streak
    const streakRes = recordLogin(u.id);

    setSession(u);
    setUser(u);
    const tok = generateSessionToken();
    setSessionToken(tok);
    setSessionTokenState(tok);
    pushActivity("auth", `Login berhasil`, { actor: u.username });
    if (streakRes.bonus) {
      pushNotif(u.id, "success", "🔥 Streak Bonus!", `Streak ${streakRes.current} hari — bonus Rp${streakRes.bonus.toLocaleString("id-ID")} masuk!`);
    }
    return { ok: true, duplicateUsers: dupUsers, streak: streakRes.current, bonus: streakRes.bonus };
  };

  const register = (username: string, password: string) => {
    const result = registerUser(username, password);
    if (result.ok) {
      const u = loginUser(username, password);
      if (u) {
        setSession(u);
        setUser(u);
        attachDeviceToUser(u.id);
        recordLogin(u.id);
        const tok = generateSessionToken();
        setSessionToken(tok);
        setSessionTokenState(tok);
        pushActivity("auth", `User baru registrasi: ${u.username}`);
        pushNotif(u.id, "success", "Selamat datang! 🎉", "Akun kamu berhasil dibuat. Login harian dapat bonus 🔥");
      }
    }
    return result;
  };

  const refresh = () => { setUser(getSession()); };

  const logout = () => {
    if (user) pushActivity("auth", `Logout`, { actor: user.username });
    clearSession();
    clearSessionToken();
    setUser(null);
    setSessionTokenState(null);
  };

  const endImpersonation = () => {
    const origin = stopImpersonate();
    if (origin) {
      setSession(origin);
      setUser(origin);
      const tok = generateSessionToken();
      setSessionToken(tok);
      setSessionTokenState(tok);
      setImpersonating(false);
      pushActivity("admin", `Impersonate diakhiri, kembali ke ${origin.username}`);
      window.location.href = (import.meta.env.BASE_URL || "/") + "admin";
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      sessionToken,
      login,
      register,
      logout,
      isAdmin: user?.role === "admin" || user?.role === "owner",
      isOwner: user?.role === "owner",
      refresh,
      isImpersonating: impersonating || isImpersonating(),
      endImpersonation,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
