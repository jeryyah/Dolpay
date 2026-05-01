import React, { useEffect, useState } from "react";
import { Bell, CheckCheck, Trash2, ArrowLeft } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Navbar, Footer } from "@/components/layout/navbar";
import {
  getUserNotifs, markAllNotifRead, markNotifRead, clearNotifs, type AppNotif,
} from "@/lib/extra-storage";

const TONE: Record<AppNotif["type"], string> = {
  info:    "border-sky-500/40 bg-sky-500/5",
  success: "border-emerald-500/40 bg-emerald-500/5",
  warning: "border-amber-500/40 bg-amber-500/5",
  danger:  "border-rose-500/40 bg-rose-500/5",
};
const ICON: Record<AppNotif["type"], string> = {
  info:    "bg-sky-500/15 text-sky-300",
  success: "bg-emerald-500/15 text-emerald-300",
  warning: "bg-amber-500/15 text-amber-300",
  danger:  "bg-rose-500/15 text-rose-300",
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [list, setList] = useState<AppNotif[]>([]);

  const refresh = () => { if (user) setList(getUserNotifs(user.id)); };
  useEffect(() => { refresh(); }, [user?.id]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-6 max-w-3xl">
        <Link href="/">
          <a className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="w-4 h-4" /> Beranda
          </a>
        </Link>

        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center shadow-lg shadow-primary/30">
              <Bell className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold">Notifikasi</h1>
              <p className="text-sm text-muted-foreground">{list.length} pemberitahuan</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { markAllNotifRead(user.id); refresh(); }}
              className="text-xs font-bold px-3 py-2 rounded-xl border border-border hover:bg-muted flex items-center gap-1.5"
            >
              <CheckCheck className="w-3.5 h-3.5" /> Tandai dibaca
            </button>
            <button
              onClick={() => { if (confirm("Hapus semua notifikasi?")) { clearNotifs(user.id); refresh(); } }}
              className="text-xs font-bold px-3 py-2 rounded-xl border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" /> Hapus
            </button>
          </div>
        </div>

        {list.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-12 text-center">
            <Bell className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
            <p className="font-bold mb-1">Belum ada notifikasi</p>
            <p className="text-sm text-muted-foreground">Pemberitahuan order, bonus, dan event akan muncul di sini.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {list.map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  markNotifRead(user.id, n.id);
                  if (n.link) navigate(n.link);
                  refresh();
                }}
                className={`w-full text-left rounded-2xl border p-4 transition-all hover:scale-[1.005] ${TONE[n.type]} ${!n.read ? "ring-1 ring-primary/30" : "opacity-90"}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${ICON[n.type]}`}>
                    <Bell className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className="text-sm font-bold truncate">{n.title}</p>
                      {!n.read && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-1">
                      {new Date(n.createdAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
