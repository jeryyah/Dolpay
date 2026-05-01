import React, { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Navbar, Footer } from "@/components/layout/navbar";
import { useAuth } from "@/lib/auth-context";
import { getUserOrders, type Order } from "@/lib/storage";
import { formatCurrency } from "@/lib/utils";
import {
  Key as KeyIcon,
  Copy,
  CheckCircle,
  ArrowLeft,
  Search,
  Eye,
  EyeOff,
  Clock,
  ShoppingBag,
} from "lucide-react";

type FilterTab = "all" | "active" | "expired" | "lifetime";

function maskKey(k?: string) {
  if (!k) return "—";
  if (k.length <= 6) return "•".repeat(k.length);
  return k.slice(0, 3) + "•".repeat(Math.max(4, k.length - 6)) + k.slice(-3);
}

function fmtRemaining(ms: number): string {
  if (ms <= 0) return "Expired";
  const sec = Math.floor(ms / 1000);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function MyKeys() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [revealAll, setRevealAll] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [tab, setTab] = useState<FilterTab>("all");
  const [q, setQ] = useState("");

  const refresh = () => {
    if (!user) return;
    const all = getUserOrders(user.id)
      .filter((o) => (o.status === "paid" || o.status === "verified") && !!o.key)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setOrders(all);
  };

  useEffect(() => {
    refresh();
    const onStore = () => refresh();
    window.addEventListener("storage", onStore);
    window.addEventListener("pinz:storage", onStore as EventListener);
    const t = setInterval(refresh, 30_000);
    return () => {
      window.removeEventListener("storage", onStore);
      window.removeEventListener("pinz:storage", onStore as EventListener);
      clearInterval(t);
    };
  }, [user?.id]);

  const filtered = useMemo(() => {
    const now = Date.now();
    return orders.filter((o) => {
      if (tab === "active") {
        if (o.durationMs === 0) return false;
        if (!o.expiresAt) return false;
        if (o.expiresAt < now) return false;
      } else if (tab === "expired") {
        if (!o.expiresAt) return false;
        if (o.expiresAt >= now) return false;
      } else if (tab === "lifetime") {
        if (o.durationMs !== 0) return false;
      }
      if (q.trim()) {
        const needle = q.trim().toLowerCase();
        const hay = `${o.productName} ${o.variantLabel} ${o.key || ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [orders, tab, q]);

  const stats = useMemo(() => {
    const now = Date.now();
    let active = 0, expired = 0, lifetime = 0;
    for (const o of orders) {
      if (o.durationMs === 0) lifetime++;
      else if (o.expiresAt && o.expiresAt < now) expired++;
      else active++;
    }
    return { total: orders.length, active, expired, lifetime };
  }, [orders]);

  const copy = async (id: string, key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
    } catch {}
  };

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 container mx-auto px-4 py-12 text-center">
          <KeyIcon className="w-12 h-12 mx-auto opacity-30 mb-3" />
          <h1 className="text-xl font-bold mb-1">My Keys</h1>
          <p className="text-sm text-muted-foreground mb-4">
            Login first to see your purchased keys.
          </p>
          <Link href="/login">
            <a className="inline-block bg-primary text-primary-foreground font-bold px-5 py-2.5 rounded-xl">
              Login
            </a>
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const tabBtn = (v: FilterTab, label: string, count?: number) => (
    <button
      onClick={() => setTab(v)}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
        tab === v
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-muted/30 text-muted-foreground border-border hover:bg-muted"
      }`}
    >
      {label}
      {typeof count === "number" && (
        <span className={`ml-1.5 text-[10px] ${tab === v ? "opacity-90" : "opacity-60"}`}>
          {count}
        </span>
      )}
    </button>
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-6 max-w-3xl">
        <Link href="/">
          <a className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
            <ArrowLeft className="w-4 h-4" /> Home
          </a>
        </Link>

        <div className="flex items-center gap-3 mb-1">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center">
            <KeyIcon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">My Keys</h1>
            <p className="text-xs text-muted-foreground">
              All license keys you have purchased.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          <Stat label="Total" value={stats.total} />
          <Stat label="Active" value={stats.active} accent="text-emerald-400" />
          <Stat label="Lifetime" value={stats.lifetime} accent="text-primary" />
          <Stat label="Expired" value={stats.expired} accent="text-rose-400" />
        </div>

        {/* Filter & search */}
        <div className="flex flex-wrap items-center gap-2 mt-5">
          {tabBtn("all", "All", stats.total)}
          {tabBtn("active", "Active", stats.active)}
          {tabBtn("lifetime", "Lifetime", stats.lifetime)}
          {tabBtn("expired", "Expired", stats.expired)}
          <div className="flex-1 min-w-[160px] relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search product or key..."
              className="w-full bg-muted/30 border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={() => setRevealAll((v) => !v)}
            className="text-[11px] font-bold border border-border rounded-lg px-2.5 py-1.5 text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-1"
            title="Show / hide all keys"
          >
            {revealAll ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {revealAll ? "Hide" : "Show"} all
          </button>
        </div>

        {/* List */}
        <div className="mt-5 space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border rounded-2xl">
              <ShoppingBag className="w-10 h-10 mx-auto opacity-30 mb-2" />
              <p className="text-sm font-bold">No keys here yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                {orders.length === 0
                  ? "Purchase a product and your license keys will appear here."
                  : "Try a different filter or clear the search."}
              </p>
              {orders.length === 0 && (
                <Link href="/">
                  <a className="inline-block mt-4 bg-primary text-primary-foreground text-xs font-bold px-4 py-2 rounded-lg">
                    Browse products
                  </a>
                </Link>
              )}
            </div>
          ) : (
            filtered.map((o) => {
              const isLifetime = o.durationMs === 0;
              const now = Date.now();
              const remaining = o.expiresAt ? o.expiresAt - now : null;
              const isExpired = remaining !== null && remaining <= 0;
              const show = revealAll || revealed[o.id] === true;
              return (
                <div
                  key={o.id}
                  className="rounded-2xl border border-border bg-card overflow-hidden"
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-sm leading-tight truncate">
                          {o.productName}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {o.variantLabel} ·{" "}
                          {formatCurrency(o.finalPriceIDR ?? o.variantPrice)} ·{" "}
                          {new Date(o.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full border ${
                          isLifetime
                            ? "bg-primary/10 text-primary border-primary/30"
                            : isExpired
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        }`}
                      >
                        {isLifetime
                          ? "LIFETIME"
                          : isExpired
                            ? "EXPIRED"
                            : "ACTIVE"}
                      </span>
                    </div>

                    <div className="mt-3 bg-background/60 border border-border rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                          License Key
                        </p>
                        <button
                          onClick={() =>
                            setRevealed((r) => ({ ...r, [o.id]: !show }))
                          }
                          className="text-[10px] flex items-center gap-1 text-muted-foreground hover:text-foreground"
                        >
                          {show ? (
                            <>
                              <EyeOff className="w-3 h-3" /> Hide
                            </>
                          ) : (
                            <>
                              <Eye className="w-3 h-3" /> Show
                            </>
                          )}
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-sm text-primary font-bold flex-1 break-all">
                          {show ? o.key : maskKey(o.key)}
                        </code>
                        <button
                          onClick={() => o.key && copy(o.id, o.key)}
                          className="text-muted-foreground hover:text-primary shrink-0 transition-colors"
                          title="Copy key"
                        >
                          {copiedId === o.id ? (
                            <CheckCircle className="w-4 h-4 text-green-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {!isLifetime && o.expiresAt && (
                      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {isExpired ? (
                          <span>
                            Expired on{" "}
                            {new Date(o.expiresAt).toLocaleDateString()}
                          </span>
                        ) : (
                          <span>
                            {fmtRemaining(remaining!)} left · ends{" "}
                            {new Date(o.expiresAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="rounded-xl bg-muted/30 border border-border p-3 text-center">
      <p className={`text-lg font-extrabold leading-none ${accent || ""}`}>
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">
        {label}
      </p>
    </div>
  );
}
