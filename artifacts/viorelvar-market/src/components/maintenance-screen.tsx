import React, { useEffect, useState } from "react";
import { Wrench, ShieldCheck } from "lucide-react";
import { getMaintenance } from "@/lib/extra-storage";
import { useAuth } from "@/lib/auth-context";

/** Fullscreen maintenance lock. Owner & admin tetap bisa akses. */
export function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth();
  const [, force] = useState(0);
  const cfg = getMaintenance();

  useEffect(() => {
    const t = setInterval(() => force((x) => x + 1), 5000);
    return () => clearInterval(t);
  }, []);

  if (!cfg.enabled || isAdmin) return <>{children}</>;

  const untilLabel = cfg.until ? new Date(cfg.until).toLocaleString("id-ID") : null;

  return (
    <div className="fixed inset-0 z-[200] bg-background flex items-center justify-center p-6 overflow-y-auto">
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="hidden md:block absolute top-0 left-1/3 w-[500px] h-[500px] bg-amber-500/15 rounded-full blur-[140px] animate-pulse" style={{ animationDuration: "8s" }} />
        <div className="hidden md:block absolute bottom-0 right-1/3 w-[480px] h-[480px] bg-orange-500/12 rounded-full blur-[140px] animate-pulse" style={{ animationDuration: "11s" }} />
      </div>
      <div className="max-w-md w-full text-center bg-card/80 backdrop-blur-xl border border-amber-500/30 rounded-3xl p-8 shadow-2xl shadow-amber-500/20">
        <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-xl shadow-amber-500/30">
          <Wrench className="w-10 h-10 text-black animate-pulse" />
        </div>
        <h1 className="text-2xl font-black mb-2">Sedang Pemeliharaan</h1>
        <p className="text-sm text-muted-foreground mb-4">{cfg.message}</p>
        {untilLabel && (
          <div className="inline-block px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs font-bold text-amber-300">
            Estimasi selesai: {untilLabel}
          </div>
        )}
        <div className="mt-6 pt-5 border-t border-border/40 text-[10px] text-muted-foreground flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3 h-3" /> Viorelvar Market · System Maintenance
        </div>
      </div>
    </div>
  );
}
