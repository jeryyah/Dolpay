import React, { useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { getUserNotifs, getUnreadCount, markAllNotifRead, markNotifRead, type AppNotif } from "@/lib/extra-storage";

const TONE: Record<AppNotif["type"], string> = {
  info:    "bg-sky-500/15 text-sky-300 border-sky-500/30",
  success: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  warning: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  danger:  "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

export function NotificationBell() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<AppNotif[]>([]);
  const [unread, setUnread] = useState(0);

  const refresh = () => {
    if (!user) return;
    setNotifs(getUserNotifs(user.id));
    setUnread(getUnreadCount(user.id));
  };

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    const t = setInterval(refresh, 4000);
    window.addEventListener("pinz_inapp_notif", handler);
    return () => { clearInterval(t); window.removeEventListener("pinz_inapp_notif", handler); };
  }, [user?.id]);

  if (!user) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
        aria-label="Notifikasi"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center ring-2 ring-background">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <p className="font-bold text-sm">Notifikasi</p>
              {unread > 0 && (
                <button
                  onClick={() => { markAllNotifRead(user.id); refresh(); }}
                  className="text-[11px] text-primary font-bold flex items-center gap-1 hover:underline"
                >
                  <CheckCheck className="w-3 h-3" /> Tandai semua
                </button>
              )}
            </div>
            {notifs.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">Belum ada notifikasi</div>
            ) : (
              <div className="max-h-96 overflow-y-auto divide-y divide-border/50">
                {notifs.slice(0, 10).map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      markNotifRead(user.id, n.id);
                      if (n.link) navigate(n.link);
                      setOpen(false);
                      refresh();
                    }}
                    className={`w-full text-left px-4 py-3 hover:bg-muted/40 transition flex items-start gap-2.5 ${!n.read ? "bg-primary/[0.03]" : ""}`}
                  >
                    <span className={`shrink-0 px-1.5 py-0.5 rounded-full border text-[9px] font-black uppercase ${TONE[n.type]}`}>
                      {n.type}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate">{n.title}</p>
                      <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                        {new Date(n.createdAt).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}
                      </p>
                    </div>
                    {!n.read && <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                  </button>
                ))}
              </div>
            )}
            <div className="border-t border-border px-3 py-2 text-center">
              <button
                onClick={() => { setOpen(false); navigate("/notifications"); }}
                className="text-[11px] text-primary font-bold hover:underline"
              >
                Lihat semua
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
