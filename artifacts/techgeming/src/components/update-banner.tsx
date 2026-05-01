import { useAutoUpdate } from "@/lib/auto-update";
import { RefreshCw, Sparkles } from "lucide-react";

export function UpdateBanner() {
  const { updateAvailable, countdown, reloadNow } = useAutoUpdate();
  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-6 sm:bottom-6 z-[90] max-w-sm sm:ml-auto">
      <div className="rounded-2xl border border-primary/40 bg-gradient-to-br from-card via-card to-purple-950/60 shadow-2xl shadow-primary/30 p-4 backdrop-blur-md">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-extrabold">Versi baru tersedia</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Halaman akan dimuat ulang otomatis dalam{" "}
              <span className="text-foreground font-bold">{countdown}s</span>.
            </p>
            <button
              onClick={reloadNow}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:brightness-110 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reload sekarang
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
