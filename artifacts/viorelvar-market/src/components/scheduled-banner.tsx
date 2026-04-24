import React, { useEffect, useState } from "react";
import { CalendarClock, X } from "lucide-react";
import { getActiveScheduledAnnouncements, type ScheduledAnnouncement } from "@/lib/extra-storage";

const TONE: Record<ScheduledAnnouncement["type"], string> = {
  info:    "from-sky-500/20 to-sky-500/5 border-sky-500/40 text-sky-100",
  warning: "from-amber-500/25 to-amber-500/5 border-amber-500/40 text-amber-100",
  success: "from-emerald-500/25 to-emerald-500/5 border-emerald-500/40 text-emerald-100",
  danger:  "from-rose-500/25 to-rose-500/5 border-rose-500/40 text-rose-100",
};

export function ScheduledAnnouncementBanner() {
  const [list, setList] = useState<ScheduledAnnouncement[]>([]);
  const [dismissed, setDismissed] = useState<string[]>(() => {
    try { return JSON.parse(sessionStorage.getItem("pinz_dismissed_sched") || "[]"); } catch { return []; }
  });

  useEffect(() => {
    const refresh = () => setList(getActiveScheduledAnnouncements());
    refresh();
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
  }, []);

  const visible = list.filter((s) => !dismissed.includes(s.id));
  if (visible.length === 0) return null;

  const dismiss = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    sessionStorage.setItem("pinz_dismissed_sched", JSON.stringify(next));
  };

  return (
    <div className="space-y-2 px-4 pt-3">
      {visible.slice(0, 2).map((a) => (
        <div
          key={a.id}
          className={`relative rounded-xl border bg-gradient-to-r ${TONE[a.type]} px-4 py-2.5 flex items-start gap-3`}
        >
          <CalendarClock className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-extrabold">{a.title}</p>
            <p className="text-[11px] opacity-90 leading-snug">{a.message}</p>
          </div>
          <button onClick={() => dismiss(a.id)} className="shrink-0 opacity-70 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
