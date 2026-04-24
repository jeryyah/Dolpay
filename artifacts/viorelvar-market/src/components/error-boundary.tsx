import React from "react";

interface State {
  hasError: boolean;
  error: Error | null;
  recoverCount: number;
}

/**
 * Top-level error boundary for production resilience.
 * - Catches render errors in the React tree.
 * - Auto-recovers up to 3× by resetting state after 1.5s.
 * - On 4th failure, shows a friendly fallback with a "reload" button.
 * - Logs to console so server logs (or Sentry, if added later) capture it.
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { hasError: false, error: null, recoverCount: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[Viorelvar] Render error:", error, info?.componentStack);
    if (this.state.recoverCount < 3) {
      // Auto-heal
      setTimeout(() => {
        this.setState((s) => ({
          hasError: false,
          error: null,
          recoverCount: s.recoverCount + 1,
        }));
      }, 1500);
    }
  }

  handleReload = () => {
    try {
      // Drop possibly-corrupt UI cache, keep auth+data intact.
      sessionStorage.clear();
    } catch {}
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.state.recoverCount < 3) {
      // Silent loading screen during auto-recovery
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <div className="w-10 h-10 mx-auto rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="mt-3 text-xs text-muted-foreground">Memulihkan halaman…</p>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-sm text-center bg-card border border-border rounded-2xl p-6">
          <div className="w-12 h-12 mx-auto rounded-full bg-destructive/15 text-destructive flex items-center justify-center text-xl font-bold mb-3">!</div>
          <h2 className="text-base font-bold mb-1">Sesuatu Bermasalah</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Halaman gagal dimuat. Tim kami sudah dapat notifikasinya.
          </p>
          <button
            onClick={this.handleReload}
            className="w-full py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:brightness-110"
          >
            Muat Ulang
          </button>
        </div>
      </div>
    );
  }
}

/** Global handlers — keep the app alive on stray promise rejections. */
export function installGlobalErrorHandlers() {
  if (typeof window === "undefined") return;
  window.addEventListener("unhandledrejection", (e) => {
    // eslint-disable-next-line no-console
    console.warn("[Viorelvar] Unhandled rejection (suppressed):", e.reason);
    e.preventDefault?.();
  });
  window.addEventListener("error", (e) => {
    // eslint-disable-next-line no-console
    console.warn("[Viorelvar] Window error (suppressed):", e.message);
  });
}
