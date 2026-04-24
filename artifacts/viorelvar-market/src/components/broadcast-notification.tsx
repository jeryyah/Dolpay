import React, { useState, useEffect } from "react";
import { X, Megaphone, AlertTriangle, CheckCircle, Info, Zap } from "lucide-react";
import { getBroadcast, hasBroadcastBeenSeen, markBroadcastSeen, type Broadcast } from "@/lib/storage";

const TYPE_CONFIG = {
  info:    { icon: <Info    className="w-5 h-5" />, bg: "from-blue-950/95 to-blue-900/90",   border: "border-blue-500/40",  badge: "bg-blue-500/20 text-blue-300",    dot: "bg-blue-400" },
  warning: { icon: <AlertTriangle className="w-5 h-5" />, bg: "from-yellow-950/95 to-yellow-900/90", border: "border-yellow-500/40", badge: "bg-yellow-500/20 text-yellow-300",  dot: "bg-yellow-400" },
  success: { icon: <CheckCircle   className="w-5 h-5" />, bg: "from-green-950/95 to-green-900/90",  border: "border-green-500/40",  badge: "bg-green-500/20 text-green-300",   dot: "bg-green-400" },
  danger:  { icon: <AlertTriangle className="w-5 h-5" />, bg: "from-red-950/95 to-red-900/90",    border: "border-red-500/40",    badge: "bg-red-500/20 text-red-300",       dot: "bg-red-400" },
};

export function BroadcastNotification() {
  const [broadcast, setBroadcast] = useState<Broadcast | null>(null);
  const [visible, setVisible]     = useState(false);
  const [closing, setClosing]     = useState(false);

  useEffect(() => {
    const check = () => {
      const bc = getBroadcast();
      if (bc && !hasBroadcastBeenSeen(bc.id)) {
        setBroadcast(bc);
        setVisible(true);
      }
    };
    check();
    // Poll every 15 seconds so new broadcasts from admin appear quickly
    const t = setInterval(check, 15000);
    return () => clearInterval(t);
  }, []);

  const dismiss = () => {
    setClosing(true);
    setTimeout(() => {
      if (broadcast) markBroadcastSeen(broadcast.id);
      setVisible(false);
      setClosing(false);
    }, 300);
  };

  if (!visible || !broadcast) return null;

  const cfg = TYPE_CONFIG[broadcast.type] || TYPE_CONFIG.info;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className={`
          relative w-full max-w-md rounded-2xl border bg-gradient-to-br ${cfg.bg} ${cfg.border}
          shadow-2xl transition-all duration-300
          ${closing ? "opacity-0 scale-95" : "opacity-100 scale-100"}
        `}
      >
        {/* Glow pulse */}
        <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${cfg.dot} animate-ping opacity-75`} />
        <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${cfg.dot}`} />

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${cfg.badge}`}>
              {cfg.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Megaphone className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-bold tracking-widest text-muted-foreground uppercase">Broadcast</span>
              </div>
              <h3 className="font-bold text-base text-foreground mt-0.5 leading-tight">
                {broadcast.title || "Pemberitahuan"}
              </h3>
            </div>
          </div>
          <button
            onClick={dismiss}
            className="text-muted-foreground hover:text-foreground transition-colors mt-0.5 p-1 rounded-lg hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message */}
        <div className="px-5 pb-4">
          <p className="text-sm text-foreground/80 leading-relaxed">{broadcast.message}</p>
          <p className="text-xs text-muted-foreground mt-2">
            {new Date(broadcast.createdAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5">
          <button
            onClick={dismiss}
            className="w-full py-2.5 bg-white/10 hover:bg-white/15 border border-white/10 rounded-xl text-sm font-bold transition-all"
          >
            Oke, Mengerti
          </button>
        </div>

        {/* Branding */}
        <div className="px-5 pb-4 flex items-center justify-center gap-1.5 opacity-40">
          <Zap className="w-3 h-3" />
          <span className="text-[10px] font-bold tracking-wider">VIORELVAR MARKET</span>
        </div>
      </div>
    </div>
  );
}
