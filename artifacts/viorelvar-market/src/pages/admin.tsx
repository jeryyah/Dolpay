import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import {
  MaintenanceTab, BackupTab, BulkStockTab, ChartsTab,
  UserMgmtTab, ActivityLogTab, TwoFATab, ChatTab, RoleTierTab,
} from "@/components/admin/admin-extra-tabs";
import {
  getOrders, adminVerifyOrder, adminRejectOrder, deleteOrder, adminCancelPending,
  getUsers, deleteUser, getAnnouncement, setAnnouncement,
  getBroadcast, setBroadcast, clearBroadcast, toUSD,
  getStockKeys, setStockKeys,
  getProductOverrides, setProductOverride,
  getAllProducts, addExtraProduct, deleteProduct, makeSlug,
  getExtraProducts, saveExtraProducts,
  getPaymentSettings, setPaymentSettings,
  getPurchaseNotifs, makeSyntheticNotif, generateRandomBuyerName,
  getDummyCommunityUsers, getDummyCommunityOrders, pushDummyOrder,
  getCoupons, upsertCoupon, deleteCoupon,
  getCategories, addCategory, renameCategory, deleteCategory, getCategoryLabel, ensureCategory,
  getPublishers, addPublisher, renamePublisher, deletePublisher, ensurePublisher,
  DUMMY,
  type Order, type User, type Broadcast, type PaymentSettings, type PurchaseNotif,
  type Coupon, type CategoryDef,
} from "@/lib/storage";
import { getRoleBadge as roleBadge } from "@/lib/extra-storage";
import { compressImageFile as compressImageFileShared } from "@/lib/image-compress";
import { PRODUCTS, type Product, type ProductCategory } from "@/data/products";
import { formatCurrency } from "@/lib/utils";
import {
  ShieldCheck, Clock, CheckCircle, XCircle, RefreshCw, Eye, Zap, LogOut,
  Download, Search, Users, Megaphone, Trash2, Ban, TrendingUp, FileDown,
  Send, Radio, Info, Settings as SettingsIcon, Package, Bell, KeyRound,
  Image as ImageIcon, Plus, X, Tag, Percent,
  LayoutDashboard, Menu, ShoppingBag, DollarSign, Server, Database, CreditCard,
  Activity, ChevronRight, Cloud, FileArchive, Mail, Sparkles, ArrowLeft, ExternalLink,
  Terminal, Code2, Hash, Boxes, FilePlus2, Copy, GitBranch,
} from "lucide-react";
import {
  AreaChart, Area, LineChart, Line,
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

const STATUS_LABELS: Record<Order["status"], { label: string; color: string; bg: string }> = {
  pending:        { label: "Menunggu Bayar",     color: "text-yellow-400",  bg: "bg-yellow-400/10 border-yellow-400/30" },
  paid:           { label: "Lunas",              color: "text-green-400",   bg: "bg-green-400/10 border-green-400/30" },
  pending_verify: { label: "Perlu Verifikasi",   color: "text-blue-400",    bg: "bg-blue-400/10 border-blue-400/30" },
  verified:       { label: "Terverifikasi",      color: "text-green-400",   bg: "bg-green-400/10 border-green-400/30" },
  cancelled:      { label: "Dibatalkan",         color: "text-red-400",     bg: "bg-red-400/10 border-red-400/30" },
};

function ProofModal({ order, onClose }: { order: Order; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl overflow-hidden max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="font-bold text-sm">Bukti Pembayaran Binance</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg font-bold leading-none">×</button>
        </div>
        {order.proofFileBase64 ? (
          <img src={order.proofFileBase64} alt="Bukti transfer" className="w-full max-h-80 object-contain bg-black/50" />
        ) : (
          <div className="p-8 text-center text-muted-foreground text-sm">Tidak ada bukti foto</div>
        )}
        <div className="px-4 py-3 text-sm text-muted-foreground">{order.proofFileName}</div>
      </div>
    </div>
  );
}

function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl p-5 max-w-xs w-full text-center">
        <p className="text-sm font-medium mb-4">{message}</p>
        <div className="flex gap-2 justify-center">
          <button onClick={onCancel} className="px-4 py-2 rounded-xl border border-border text-sm font-bold hover:bg-muted transition-all">Batal</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-xl bg-destructive text-white text-sm font-bold hover:bg-destructive/80 transition-all">Ya, Lanjut</button>
        </div>
      </div>
    </div>
  );
}

// ─── Live Purchase Toast ──────────────────────────────────────────────────
function LivePurchaseToast({ notif }: { notif: PurchaseNotif }) {
  return (
    <div className="fixed bottom-4 right-4 z-[250] animate-in slide-in-from-bottom-5 duration-500">
      <div className="bg-card border border-green-500/40 rounded-2xl shadow-2xl shadow-green-500/10 px-4 py-3 max-w-xs flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-green-500/15 flex items-center justify-center shrink-0">
          <CheckCircle className="w-5 h-5 text-green-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-green-400 font-bold mb-0.5">PEMBELIAN BARU</p>
          <p className="text-sm font-bold truncate">@{notif.username}</p>
          {notif.synthetic ? (
            <p className="text-xs text-muted-foreground truncate">beli {notif.productName}</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground truncate">{notif.productName} · {notif.variantLabel}</p>
              <code className="text-[10px] font-mono text-primary mt-0.5 block truncate">{notif.key}</code>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

type AdminTab = "dashboard" | "pending_verify" | "orders" | "users" | "notifications" | "broadcast" | "announcement" | "settings" | "coupons" | "download" | "maintenance" | "backup" | "bulk" | "charts" | "usermgmt" | "roletier" | "activity" | "twofa" | "chat";

export default function Admin() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();

  const [orders, setOrders]       = useState<Order[]>([]);
  const [users2, setUsers2]       = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [topSearch, setTopSearch] = useState("");
  const [search, setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState<Order["status"] | "all">("all");
  const [viewingProof, setViewingProof] = useState<Order | null>(null);
  const [announcement, setAnnouncementText] = useState(getAnnouncement());
  const [announceSaved, setAnnounceSaved] = useState(false);
  const [activeBroadcast, setActiveBroadcast] = useState<Broadcast | null>(getBroadcast());
  const [bcTitle, setBcTitle] = useState("");
  const [bcMessage, setBcMessage] = useState("");
  const [bcType, setBcType] = useState<Broadcast["type"]>("info");
  const [bcSent, setBcSent] = useState(false);
  const [confirm, setConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [liveToast, setLiveToast] = useState<PurchaseNotif | null>(null);
  const [notifs, setNotifs] = useState<PurchaseNotif[]>(getPurchaseNotifs());
  // Auto-incrementing dummy stats driven by the synthetic notif loop.
  const [liveDelta, setLiveDelta] = useState({ orders: 0, verified: 0, pending: 0, revenueIDR: 0 });
  const [dummyOrdersTick, setDummyOrdersTick] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [downloadInfo, setDownloadInfo] = useState<{ size?: number; updatedAt?: string }>({});
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [paySettings, setPaySettings] = useState<PaymentSettings>(getPaymentSettings());
  const [paySaved, setPaySaved] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const synthRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sinyal dari AdminChatNotifier (klik toast notif chat) — langsung
  // pindah ke tab Chat begitu admin masuk halaman /admin.
  useEffect(() => {
    try {
      const want = localStorage.getItem("pinz_admin_open_tab");
      if (want === "chat") {
        setActiveTab("chat" as AdminTab);
        localStorage.removeItem("pinz_admin_open_tab");
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!user || (user.role !== "admin" && user.role !== "owner")) {
      navigate("/login");
      return;
    }
    refresh();
    intervalRef.current = setInterval(refresh, 30000);

    // Synthetic live purchase notif (every 6-14s) — also pushes a dummy order
    // so the admin stat cards (Total Order, Terverifikasi, Pendapatan)
    // visibly tick upward in real time.
    const tick = () => {
      const notif = makeSyntheticNotif();
      const dummyOrder = pushDummyOrder();
      setLiveToast(notif);
      setLiveDelta((d) => ({
        orders:     d.orders + 1,
        verified:   d.verified + 1,
        pending:    d.pending + (Math.random() < 0.15 ? 1 : 0),
        revenueIDR: d.revenueIDR + dummyOrder.variantPrice,
      }));
      setDummyOrdersTick((t) => t + 1);
      setTimeout(() => setLiveToast(null), 4500);
      synthRef.current = setTimeout(tick, 6000 + Math.random() * 8000) as any;
    };
    synthRef.current = setTimeout(tick, 3500) as any;

    // Poll version.json every 10s so the admin panel can show the live
    // build version + last-build time of the running website.
    const refreshInfo = async () => {
      try {
        const r = await fetch(
          `${import.meta.env.BASE_URL}version.json?ts=${Date.now()}`,
          { cache: "no-store" },
        );
        if (r.ok) {
          const j = await r.json();
          setDownloadInfo({
            updatedAt: j?.builtAt,
            size: j?.bundleSize,
          });
        }
      } catch {}
    };
    refreshInfo();
    const dlTimer = setInterval(refreshInfo, 10000);

    // Listen for real purchases
    const onRealPurchase = (e: any) => {
      const n = e.detail as PurchaseNotif;
      setLiveToast(n);
      setNotifs(getPurchaseNotifs());
      setTimeout(() => setLiveToast(null), 5000);
    };
    window.addEventListener("pinz_new_purchase", onRealPurchase);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (synthRef.current) clearTimeout(synthRef.current);
      clearInterval(dlTimer);
      window.removeEventListener("pinz_new_purchase", onRealPurchase);
    };
  }, [user]);

  const refresh = () => {
    setOrders(getOrders().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    setUsers2(getUsers());
    setNotifs(getPurchaseNotifs());
    setLastRefresh(new Date());
  };

  const handleVerify = (id: string) => { adminVerifyOrder(id); refresh(); };
  const handleReject = (id: string) => { adminRejectOrder(id); refresh(); };
  const handleDeleteOrder = (id: string) => { setConfirm({ message: "Hapus order ini permanen?", onConfirm: () => { deleteOrder(id); refresh(); setConfirm(null); } }); };
  const handleDeleteUser = (id: string, username: string) => { setConfirm({ message: `Hapus user @${username}?`, onConfirm: () => { deleteUser(id); refresh(); setConfirm(null); } }); };
  const handleCancelPending = () => { const c = adminCancelPending(); refresh(); setConfirm(null); alert(`${c} order pending dibatalkan.`); };
  const handleSaveAnnouncement = () => { setAnnouncement(announcement); setAnnounceSaved(true); setTimeout(() => setAnnounceSaved(false), 2000); };

  const handleSendBroadcast = () => {
    if (!bcMessage.trim()) return;
    const bc = setBroadcast({ title: bcTitle.trim() || "Pemberitahuan", message: bcMessage.trim(), type: bcType });
    setActiveBroadcast(bc);
    setBcSent(true);
    setBcMessage(""); setBcTitle("");
    setTimeout(() => setBcSent(false), 2500);
  };
  const handleClearBroadcast = () => { clearBroadcast(); setActiveBroadcast(null); };

  const handleDownload = () => {
    // Trigger a download of the freshly-built project bundle (.tar.gz).
    // The bundle is regenerated on every dev/build start by the
    // generate-version script, so it always matches the running website.
    //
    // Resolution order for the download URL:
    //   1. VITE_DOWNLOAD_URL  — explicit override (e.g. CDN / GitHub Release / R2)
    //   2. window.location.origin + BASE_URL + bundle  — absolute URL pointing
    //      at whichever site the admin is currently on (Vercel domain,
    //      custom domain, etc.). Always a real "https://..." link, never
    //      a bare relative path, so it works when shared / embedded too.
    const overrideUrl = (import.meta.env.VITE_DOWNLOAD_URL as string | undefined)?.trim();
    const basePath = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
    const fallbackUrl = `${window.location.origin}${basePath}/viorelvar-project.tar.gz`;
    const downloadUrl = overrideUrl && overrideUrl.length > 0 ? overrideUrl : fallbackUrl;
    const sep = downloadUrl.includes("?") ? "&" : "?";

    const a = document.createElement("a");
    a.href = `${downloadUrl}${sep}ts=${Date.now()}`;
    a.download = "viorelvar-project.tar.gz";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleOpenSite = () => {
    const url = `${window.location.origin}${(import.meta.env.BASE_URL || "/").replace(/\/$/, "")}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleExportCSV = () => {
    const header = ["Order ID", "Username", "Nama Pembeli", "Produk", "Varian", "Harga (IDR)", "Metode", "Status", "Key", "Tanggal"];
    const rows = orders.map((o) => [o.id, o.username, o.buyerName, o.productName, o.variantLabel, o.variantPrice, o.paymentMethod.toUpperCase(), o.status, o.key || "-", new Date(o.createdAt).toLocaleString("id-ID")]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "orders-viorelvar.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleSavePay = () => {
    setPaymentSettings(paySettings);
    setPaySaved(true);
    setTimeout(() => setPaySaved(false), 2000);
  };

  if (!user || (user.role !== "admin" && user.role !== "owner")) return null;

  // Stats
  const pendingVerifyCount = orders.filter((o) => o.status === "pending_verify").length;
  const pendingPayCount    = orders.filter((o) => o.status === "pending").length;
  const verifiedCount      = orders.filter((o) => o.status === "verified").length;
  const revenueIDR         = orders.filter((o) => o.status === "verified" || o.status === "paid").reduce((s, o) => s + o.variantPrice, 0);

  const fmt = (n: number) => n.toLocaleString("id-ID");

  const filteredOrders = (activeTab === "pending_verify"
    ? orders.filter((o) => o.status === "pending_verify")
    : orders
      .filter((o) => statusFilter === "all" || o.status === statusFilter)
      .filter((o) => {
        const q = search.toLowerCase();
        return !q || o.id.toLowerCase().includes(q) || o.username.toLowerCase().includes(q) || o.buyerName.toLowerCase().includes(q) || o.productName.toLowerCase().includes(q);
      })
  );

  const tabs: { key: AdminTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: "dashboard",      label: "Dashboard",    icon: <LayoutDashboard className="w-4 h-4" /> },
    { key: "orders",         label: "Order",        icon: <ShoppingBag className="w-4 h-4" /> },
    { key: "pending_verify", label: "Verifikasi",   icon: <Clock className="w-4 h-4" />,    badge: pendingVerifyCount },
    { key: "users",          label: "User",         icon: <Users className="w-4 h-4" /> },
    { key: "coupons",        label: "Kupon",        icon: <Tag className="w-4 h-4" /> },
    { key: "notifications",  label: "Notifikasi",   icon: <Bell className="w-4 h-4" />,     badge: notifs.length > 0 ? Math.min(notifs.length, 99) : undefined },
    { key: "broadcast",      label: "Broadcast",    icon: <Radio className="w-4 h-4" />,     badge: activeBroadcast ? 1 : undefined },
    { key: "announcement",   label: "Pengumuman",   icon: <Megaphone className="w-4 h-4" /> },
    { key: "charts",         label: "Sales Charts", icon: <LayoutDashboard className="w-4 h-4" /> },
    { key: "usermgmt",       label: "Manage Users", icon: <Users className="w-4 h-4" /> },
    { key: "roletier",       label: "Roles & Tiers",icon: <Sparkles className="w-4 h-4" /> },
    { key: "activity",       label: "Activity Log", icon: <Clock className="w-4 h-4" /> },
    { key: "chat",           label: "Live Chat",    icon: <Bell className="w-4 h-4" /> },
    { key: "bulk",           label: "Bulk Stock",   icon: <FileArchive className="w-4 h-4" /> },
    { key: "backup",         label: "Backup DB",    icon: <FileArchive className="w-4 h-4" /> },
    { key: "maintenance",    label: "Maintenance",  icon: <SettingsIcon className="w-4 h-4" /> },
    { key: "twofa",          label: "2FA Owner",    icon: <SettingsIcon className="w-4 h-4" /> },
    { key: "settings",       label: "Settings",     icon: <SettingsIcon className="w-4 h-4" /> },
    { key: "download",       label: "Download Project", icon: <FileArchive className="w-4 h-4" /> },
  ];

  const tabTitle: Record<AdminTab, string> = {
    dashboard: "Dashboard",
    pending_verify: "Verifikasi Pembayaran",
    orders: "Daftar Order",
    users: "User",
    notifications: "Notifikasi",
    settings: "Settings",
    coupons: "Kupon Diskon",
    broadcast: "Broadcast",
    announcement: "Pengumuman",
    download: "Download Project",
    maintenance: "Maintenance Mode",
    backup: "Backup / Restore Database",
    bulk: "Bulk Upload Stock Keys",
    charts: "Sales Charts",
    usermgmt: "Manage Users (Ban / Tags / Bonus / Impersonate)",
    roletier: "Roles & Tiers (Reseller / Pro / Elite)",
    activity: "Activity Log",
    twofa: "2FA Owner",
    chat: "Live Chat Inbox",
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Live UI background */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="hidden md:block absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/15 rounded-full blur-[140px] animate-pulse" style={{ animationDuration: "8s" }} />
        <div className="hidden md:block absolute bottom-0 right-1/4 w-[480px] h-[480px] bg-purple-500/12 rounded-full blur-[140px] animate-pulse" style={{ animationDuration: "11s" }} />
        <div className="hidden md:block absolute top-1/3 right-0 w-[420px] h-[420px] bg-blue-500/10 rounded-full blur-[140px] animate-pulse" style={{ animationDuration: "13s" }} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,transparent_55%,rgba(170,255,0,0.04)_72%,transparent_85%)]" />
      </div>

      {viewingProof && <ProofModal order={viewingProof} onClose={() => setViewingProof(null)} />}
      {confirm && <ConfirmDialog message={confirm.message} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}
      {liveToast && <LivePurchaseToast notif={liveToast} />}
      {editingProduct && (
        <ProductEditModal
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSaved={() => { setEditingProduct(null); refresh(); }}
        />
      )}

      <div className="flex min-h-screen relative z-10">
        {/* SIDEBAR — desktop fixed, mobile drawer */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <aside
          className={`fixed lg:sticky top-0 left-0 z-50 lg:z-auto h-screen w-64 shrink-0 border-r border-border/60 bg-card/95 backdrop-blur-xl flex flex-col transition-transform lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {/* Logo */}
          <div className="px-5 h-16 flex items-center gap-3 border-b border-border/60">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="leading-tight">
              <p className="font-extrabold text-sm tracking-wide">VIORELVAR</p>
              <p className="text-[10px] text-muted-foreground -mt-0.5">Admin Dashboard</p>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => { setActiveTab(t.key); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeTab === t.key
                    ? "bg-gradient-to-r from-primary to-purple-600 text-white shadow-lg shadow-primary/25"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                {t.icon}
                <span className="flex-1 text-left">{t.label}</span>
                {t.badge != null && t.badge > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    activeTab === t.key ? "bg-white/25 text-white" : "bg-destructive text-white"
                  }`}>{t.badge}</span>
                )}
              </button>
            ))}
          </nav>

          {/* Profile card */}
          <div className="border-t border-border/60 p-3">
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/30">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                {user.username[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0 leading-tight">
                <p className="text-xs font-bold truncate">{user.username}</p>
                <p className="text-[10px] text-muted-foreground truncate">{user.role}@viorelvar</p>
              </div>
              <button
                onClick={() => { logout(); navigate("/login"); }}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                title="Logout"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </aside>

        {/* MAIN */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Top bar */}
          <header className="sticky top-0 z-30 h-16 border-b border-border/60 bg-background/70 backdrop-blur-xl flex items-center gap-3 px-4 lg:px-6">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-muted text-muted-foreground"
              aria-label="Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate("/")}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-muted/40 border border-border/60 text-foreground/90 hover:bg-muted hover:border-primary/40 active:scale-95 transition-all"
              aria-label="Kembali ke Beranda"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Beranda</span>
            </button>

            <div className="hidden md:flex items-center gap-2 flex-1 max-w-md bg-muted/40 border border-border/60 rounded-xl px-3 py-2">
              <Search className="w-4 h-4 text-muted-foreground" />
              <input
                value={topSearch}
                onChange={(e) => { setTopSearch(e.target.value); setSearch(e.target.value); }}
                placeholder="Cari order, user, produk..."
                className="bg-transparent flex-1 text-sm focus:outline-none"
              />
              <kbd className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">Ctrl /</kbd>
            </div>
            <div className="flex-1 md:hidden">
              <p className="font-bold text-base">{tabTitle[activeTab]}</p>
            </div>

            <button
              onClick={refresh}
              title="Refresh"
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveTab("notifications")}
              className="relative p-2 rounded-lg hover:bg-muted text-muted-foreground"
            >
              <Bell className="w-4 h-4" />
              {pendingVerifyCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-destructive" />
              )}
            </button>
            <Link href="/">
              <button className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground">
                <Zap className="w-3.5 h-3.5" /> Toko
              </button>
            </Link>
            <div className="flex items-center gap-2 pl-2 border-l border-border/60">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                {user.username[0]?.toUpperCase()}
              </div>
              <div className="hidden md:block leading-tight">
                <p className="text-xs font-bold">{user.username}</p>
                <p className="text-[10px] text-green-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" /> Online
                </p>
              </div>
            </div>
          </header>

          <main className="flex-1 p-4 lg:p-6 space-y-5 max-w-[1400px] mx-auto w-full">

        {/* DASHBOARD */}
        {activeTab === "dashboard" && (
          <DashboardOverview
            user={user}
            orders={orders}
            users2={users2}
            notifs={notifs}
            liveDelta={liveDelta}
            verifiedCount={verifiedCount}
            pendingPayCount={pendingPayCount}
            pendingVerifyCount={pendingVerifyCount}
            revenueIDR={revenueIDR}
            announcement={announcement}
            activeBroadcast={activeBroadcast}
            downloadInfo={downloadInfo}
            onDownload={handleDownload}
            onGoTo={(t) => setActiveTab(t)}
          />
        )}

        {/* DOWNLOAD PROJECT */}
        {activeTab === "download" && (
          <DownloadPanel info={downloadInfo} onDownload={handleDownload} onOpenSite={handleOpenSite} />
        )}


        {/* PENDING VERIFY */}
        {activeTab === "pending_verify" && (
          <>
            {filteredOrders.length === 0 ? (
              <EmptyState icon={<CheckCircle />} title="Tidak ada pesanan perlu verifikasi" sub="Semua sudah ditangani" />
            ) : (
              <div className="space-y-3">
                {filteredOrders.map((order) => (
                  <OrderCard key={order.id} order={order} onVerify={handleVerify} onReject={handleReject} onViewProof={setViewingProof} onDelete={handleDeleteOrder} />
                ))}
              </div>
            )}
          </>
        )}

        {/* ALL ORDERS */}
        {activeTab === "orders" && (
          <>
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari order ID, username, produk..." className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as Order["status"] | "all")} className="bg-card border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="all">Semua Status</option>
                <option value="pending">Menunggu Bayar</option>
                <option value="paid">Lunas</option>
                <option value="pending_verify">Perlu Verifikasi</option>
                <option value="verified">Terverifikasi</option>
                <option value="cancelled">Dibatalkan</option>
              </select>
              <button onClick={handleExportCSV} className="flex items-center gap-1.5 px-3 py-2.5 bg-card border border-border rounded-xl text-xs font-bold hover:bg-muted whitespace-nowrap"><FileDown className="w-3.5 h-3.5" /> Export CSV</button>
              <button onClick={() => setConfirm({ message: "Batalkan semua order yang belum bayar?", onConfirm: handleCancelPending })} className="flex items-center gap-1.5 px-3 py-2.5 bg-destructive/10 border border-destructive/30 text-destructive rounded-xl text-xs font-bold hover:bg-destructive/20 whitespace-nowrap"><Ban className="w-3.5 h-3.5" /> Batalkan Pending</button>
            </div>
            {filteredOrders.length === 0 ? (
              <EmptyState icon={<Search />} title="Tidak ada order ditemukan" sub="Coba ubah filter pencarian" />
            ) : (
              <div className="space-y-3">
                {filteredOrders.map((order) => (
                  <OrderCard key={order.id} order={order} onVerify={handleVerify} onReject={handleReject} onViewProof={setViewingProof} onDelete={handleDeleteOrder} showDelete />
                ))}
              </div>
            )}
          </>
        )}

        {/* NOTIFICATIONS (Live Purchase Feed) */}
        {activeTab === "notifications" && (
          <div className="bg-card/80 backdrop-blur border border-border rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <p className="font-bold text-sm flex items-center gap-2"><Bell className="w-4 h-4 text-primary" />Live Purchase Feed</p>
              <span className="text-xs text-muted-foreground">{notifs.length} notif</span>
            </div>
            {notifs.length === 0 ? (
              <div className="p-12 text-center text-sm text-muted-foreground">Belum ada pembelian. Notifikasi simulasi tetap berjalan untuk demo aktivitas.</div>
            ) : (
              <div className="divide-y divide-border/60 max-h-[500px] overflow-y-auto">
                {notifs.map((n) => (
                  <div key={n.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">@{n.username} <span className="text-muted-foreground font-normal">beli</span> {n.productName}</p>
                      {!n.synthetic && (
                        <p className="text-xs text-muted-foreground truncate">{n.variantLabel} · <code className="font-mono text-primary">{n.key}</code></p>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{new Date(n.createdAt).toLocaleTimeString("id-ID")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* USERS */}
        {activeTab === "users" && (
          (() => {
            const dummyUsers = getDummyCommunityUsers();
            const dummyOrdersAll = getDummyCommunityOrders();
            const realIds = new Set(users2.map((u) => u.id));
            const merged = [...users2, ...dummyUsers.filter((d) => !realIds.has(d.id))];
            const q = search.trim().toLowerCase();
            const filtered = q
              ? merged.filter((u) => u.username.toLowerCase().includes(q))
              : merged;
            const PAGE = 50;
            const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE));
            const page = Math.min(usersPage, totalPages);
            const visible = filtered.slice((page - 1) * PAGE, page * PAGE);
            // dummyOrdersTick is referenced so the list re-renders as new dummy orders stream in
            void dummyOrdersTick;
            const dummyOrderCount = (uid: string) =>
              dummyOrdersAll.filter((o) => o.userId === uid).length;
            return (
              <div className="bg-card/80 backdrop-blur border border-border rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <p className="font-bold text-sm">Komunitas Pengguna ({fmt(filtered.length)})</p>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <input
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setUsersPage(1); }}
                        placeholder="Cari username…"
                        className="pl-8 pr-2 py-1.5 text-xs bg-muted/50 border border-border rounded-lg w-44"
                      />
                    </div>
                  </div>
                </div>
                <div className="divide-y divide-border/60 max-h-[560px] overflow-y-auto">
                  {visible.map((u) => {
                    const roleMap: Record<string, string> = { owner: "Owner", admin: "PRO", user: "User" };
                    const roleColor: Record<string, string> = { owner: "text-purple-400 bg-purple-400/10 border-purple-400/30", admin: "text-amber-300 bg-gradient-to-r from-amber-500/20 to-yellow-500/10 border-amber-400/40", user: "text-muted-foreground bg-muted border-border" };
                    const ordersCount = orders.filter((o) => o.userId === u.id).length + dummyOrderCount(u.id);
                    const isDummy = u.id.startsWith("dummy-");
                    return (
                      <div key={u.id} className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-bold uppercase">{u.username[0]}</div>
                          <div>
                            <p className="font-semibold text-sm">@{u.username}</p>
                            <p className="text-xs text-muted-foreground">{ordersCount} order · Bergabung {new Date(u.createdAt).toLocaleDateString("id-ID")}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {(() => { const b = roleBadge(u.role); return (
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${b.className}`}>{b.label}</span>
                          ); })()}
                          {u.role === "user" && !isDummy && (
                            <button onClick={() => handleDeleteUser(u.id, u.username)} className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10" title="Hapus user">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-border text-xs">
                  <span className="text-muted-foreground">Hal {page} / {totalPages}</span>
                  <div className="flex gap-1.5">
                    <button onClick={() => setUsersPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1 rounded-lg border border-border disabled:opacity-40 hover:bg-muted">Prev</button>
                    <button onClick={() => setUsersPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1 rounded-lg border border-border disabled:opacity-40 hover:bg-muted">Next</button>
                  </div>
                </div>
              </div>
            );
          })()
        )}

        {/* SETTINGS — Payment + Products */}
        {activeTab === "settings" && (
          <div className="space-y-5">
            {/* Pengaturan Pembayaran (QRIS Manual) */}
            <div className="bg-card/80 backdrop-blur border border-border rounded-2xl p-5 space-y-4">
              <p className="font-bold text-sm flex items-center gap-2"><SettingsIcon className="w-4 h-4 text-primary" />Pengaturan Pembayaran</p>

              <div>
                <label className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-1.5 block">Binance Pay ID</label>
                <input
                  value={paySettings.binancePayId}
                  onChange={(e) => setPaySettings({ ...paySettings, binancePayId: e.target.value })}
                  placeholder="Misal: 478829361"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ImageUpload
                  label="QRIS Image (foto QR statis)"
                  value={paySettings.qrisImageBase64}
                  onChange={(b64) => setPaySettings({ ...paySettings, qrisImageBase64: b64 })}
                />
                <ImageUpload
                  label="Binance QR Image"
                  value={paySettings.binanceQrBase64}
                  onChange={(b64) => setPaySettings({ ...paySettings, binanceQrBase64: b64 })}
                />
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <p className="text-sm font-bold mb-1">QRIS Manual</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Mode pembayaran QRIS sepenuhnya <strong>manual</strong>. Pembeli scan
                  gambar QR statis di atas, transfer sesuai total + kode unik, lalu klik
                  <em> "Saya Sudah Membayar"</em>. Anda cek mutasi e-wallet / m-banking
                  lalu konfirmasi pesanan secara manual dari tab <strong>Order</strong>.
                  Tidak ada API gateway pihak ketiga — tidak perlu API key, tidak perlu
                  konfigurasi proxy.
                </p>
              </div>

              <button onClick={handleSavePay} className="px-5 py-2.5 bg-primary text-primary-foreground font-bold text-sm rounded-xl hover:brightness-110 transition-all">
                {paySaved ? "✓ Tersimpan!" : "Simpan Pengaturan Pembayaran"}
              </button>
            </div>

            {/* Products manager — code-style panel */}
            <ProductManagerPanel
              onEdit={(p) => setEditingProduct(p)}
              onChanged={refresh}
            />
          </div>
        )}

        {/* COUPONS */}
        {activeTab === "coupons" && <CouponManager />}

        {/* BROADCAST */}
        {activeTab === "broadcast" && (
          <div className="space-y-4">
            {activeBroadcast && (
              <div className="bg-card border border-primary/30 rounded-2xl p-4 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-400 mt-1.5 animate-pulse shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-green-400 mb-1">BROADCAST AKTIF</p>
                    <p className="font-bold text-sm">{activeBroadcast.title}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{activeBroadcast.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">Dikirim: {new Date(activeBroadcast.createdAt).toLocaleString("id-ID")}</p>
                  </div>
                </div>
                <button onClick={handleClearBroadcast} className="shrink-0 px-3 py-1.5 bg-destructive/10 border border-destructive/30 text-destructive text-xs font-bold rounded-xl hover:bg-destructive/20">Hapus</button>
              </div>
            )}
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <div>
                <p className="font-bold text-sm mb-0.5">Kirim Broadcast Notifikasi</p>
                <p className="text-xs text-muted-foreground">Notifikasi pop-up yang muncul ke semua pengguna aktif.</p>
              </div>
              <div>
                <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-2">Tipe Notifikasi</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {([
                    { val: "info",    label: "Info",      color: "border-blue-500/40 text-blue-400",    active: "bg-blue-500/15 border-blue-500" },
                    { val: "success", label: "Sukses",    color: "border-green-500/40 text-green-400",  active: "bg-green-500/15 border-green-500" },
                    { val: "warning", label: "Peringatan",color: "border-yellow-500/40 text-yellow-400",active: "bg-yellow-500/15 border-yellow-500" },
                    { val: "danger",  label: "Bahaya",    color: "border-red-500/40 text-red-400",      active: "bg-red-500/15 border-red-500" },
                  ] as const).map((t) => (
                    <button key={t.val} onClick={() => setBcType(t.val)} className={`py-2 rounded-xl border text-xs font-bold transition-all ${bcType === t.val ? t.active + " " + t.color : "border-border text-muted-foreground hover:border-border/80"}`}>{t.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-2">Judul (opsional)</p>
                <input value={bcTitle} onChange={(e) => setBcTitle(e.target.value)} placeholder="Contoh: Maintenance Server" className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-2">Pesan Broadcast <span className="text-destructive">*</span></p>
                <textarea value={bcMessage} onChange={(e) => setBcMessage(e.target.value)} placeholder="Tulis pesan yang akan dikirim ke semua pengguna..." rows={3} className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
              </div>
              <div className="flex gap-2">
                <button onClick={handleSendBroadcast} disabled={!bcMessage.trim()} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-bold text-sm rounded-xl hover:brightness-110 transition-all disabled:opacity-40">
                  <Send className="w-4 h-4" />{bcSent ? "✓ Terkirim!" : "Kirim Broadcast"}
                </button>
                {activeBroadcast && (
                  <button onClick={handleClearBroadcast} className="px-4 py-2.5 border border-destructive/30 text-destructive text-sm font-bold rounded-xl hover:bg-destructive/10">Hapus Broadcast</button>
                )}
              </div>
              <div className="bg-muted/30 border border-border/50 rounded-xl p-3 flex items-start gap-2">
                <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">Broadcast muncul sebagai pop-up di layar pengguna. Hanya satu broadcast yang aktif dalam satu waktu.</p>
              </div>
            </div>
          </div>
        )}

        {/* ANNOUNCEMENT */}
        {activeTab === "announcement" && (
          <div className="bg-card/80 backdrop-blur border border-border rounded-2xl p-5 space-y-4">
            <div>
              <p className="font-bold text-sm mb-1">Banner Pengumuman</p>
              <p className="text-xs text-muted-foreground">Pesan ini akan muncul sebagai banner di atas halaman utama untuk semua pengguna. Kosongkan untuk menghapus banner.</p>
            </div>
            <textarea value={announcement} onChange={(e) => setAnnouncementText(e.target.value)} placeholder="Contoh: Server maintenance 25 April 2026 pukul 22.00 WIB." rows={4} className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
            <div className="flex items-center gap-3">
              <button onClick={handleSaveAnnouncement} className="px-5 py-2.5 bg-primary text-primary-foreground font-bold text-sm rounded-xl hover:brightness-110 transition-all">{announceSaved ? "✓ Tersimpan!" : "Simpan Pengumuman"}</button>
              {announcement && (
                <button onClick={() => { setAnnouncementText(""); setAnnouncement(""); }} className="px-4 py-2.5 border border-destructive/30 text-destructive text-sm font-bold rounded-xl hover:bg-destructive/10">Hapus Banner</button>
              )}
            </div>
            {announcement && (
              <div className="border border-primary/30 bg-primary/5 rounded-xl px-4 py-3 text-sm">
                <p className="text-xs text-muted-foreground mb-1 font-bold">Preview:</p>
                <p className="text-foreground">{announcement}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "maintenance" && <MaintenanceTab />}
        {activeTab === "backup" && <BackupTab />}
        {activeTab === "bulk" && <BulkStockTab />}
        {activeTab === "charts" && <ChartsTab orders={orders} />}
        {activeTab === "usermgmt" && <UserMgmtTab users={users2} refresh={() => { setOrders(getOrders()); setUsers2(getUsers()); }} />}
        {activeTab === "roletier" && <RoleTierTab users={users2} refresh={() => { setOrders(getOrders()); setUsers2(getUsers()); }} />}
        {activeTab === "activity" && <ActivityLogTab />}
        {activeTab === "twofa" && <TwoFATab />}
        {activeTab === "chat" && <ChatTab />}

          </main>
        </div>
      </div>
    </div>
  );
}

// ─── Image Upload helper ──────────────────────────────────────────────────
// Compress a user-uploaded image to a sane size before persisting it to
// localStorage. Default budget: 720px on the long edge, JPEG q≈0.82, PNG kept
// for transparent QRIS images. Keeps the saved blob well under ~120KB so we
// never trip the browser's localStorage quota when combined with the rest of
// the app state.
async function compressImageFile(
  file: File,
  maxSize = 720,
  quality = 0.82,
): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(file);
  });
  // Skip compression entirely for tiny files (already small enough).
  if (dataUrl.length < 80_000) return dataUrl;
  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(1, maxSize / Math.max(img.width, img.height));
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0, w, h);
      // PNG keeps transparency for QR codes that need it.
      const isPng = file.type === "image/png" || dataUrl.startsWith("data:image/png");
      const out = isPng ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", quality);
      // If JPEG ended up bigger than PNG (rare for QRs), keep PNG.
      resolve(out.length < dataUrl.length ? out : dataUrl);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function ImageUpload({ label, value, onChange }: { label: string; value: string; onChange: (b64: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const handle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const compressed = await compressImageFile(f);
      onChange(compressed);
    } catch (err) {
      console.error("[image] compress failed, falling back to raw", err);
      const r = new FileReader();
      r.onloadend = () => onChange(r.result as string);
      r.readAsDataURL(f);
    } finally {
      // Reset input so picking the same file again still triggers onChange.
      if (ref.current) ref.current.value = "";
    }
  };
  return (
    <div>
      <label className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-1.5 block">{label}</label>
      <input ref={ref} type="file" accept="image/*" onChange={handle} className="hidden" />
      <div className="flex items-center gap-2">
        {value ? (
          <img src={value} alt="" className="w-14 h-14 rounded-lg object-cover border border-border" />
        ) : (
          <div className="w-14 h-14 rounded-lg bg-muted/40 border border-dashed border-border flex items-center justify-center">
            <ImageIcon className="w-5 h-5 text-muted-foreground" />
          </div>
        )}
        <button onClick={() => ref.current?.click()} className="px-3 py-2 bg-background border border-border rounded-lg text-xs font-bold hover:bg-muted">{value ? "Ganti" : "Upload"}</button>
        {value && <button onClick={() => onChange("")} className="px-3 py-2 text-destructive text-xs font-bold hover:underline">Hapus</button>}
      </div>
    </div>
  );
}

// ─── Product Manager Panel ────────────────────────────────────────────────
function ProductManagerPanel({ onEdit, onChanged }: { onEdit: (p: Product) => void; onChanged: () => void }) {
  const [creating, setCreating] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [managingCats, setManagingCats] = useState(false);
  const [managingPubs, setManagingPubs] = useState(false);
  const all = getAllProducts();
  const overrides = getProductOverrides();
  const customIds = new Set(getExtraProducts().map((p) => p.id));
  const totalVariants = all.reduce((s, p) => s + p.variants.length, 0);
  const totalKeys = all.reduce((s, p) => s + p.variants.reduce((a, v) => a + getStockKeys(p.id, v.id).length, 0), 0);

  const refreshLocal = () => { setTick((t) => t + 1); onChanged(); };

  const confirmDelete = () => {
    if (!confirmId) return;
    deleteProduct(confirmId);
    setConfirmId(null);
    refreshLocal();
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Package className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-bold text-base">Manajemen Produk</p>
            <p className="text-xs text-muted-foreground">Tambah, ubah, atau hapus produk yang dijual.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setManagingCats(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border border-border bg-background hover:bg-muted transition-colors"
          >
            <Tag className="w-3.5 h-3.5" />Kategori
          </button>
          <button
            onClick={() => setManagingPubs(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border border-border bg-background hover:bg-muted transition-colors"
          >
            <Boxes className="w-3.5 h-3.5" />Publisher
          </button>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:brightness-110 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />Tambah Produk
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 border-b border-border bg-muted/20">
        <StatChip icon={<Boxes className="w-4 h-4" />}    label="Total Produk"   value={all.length}    accent="text-primary" />
        <StatChip icon={<Package className="w-4 h-4" />}  label="Total Varian"   value={totalVariants} accent="text-blue-400" />
        <StatChip icon={<KeyRound className="w-4 h-4" />} label="Total Stok Key" value={totalKeys}     accent="text-emerald-400" />
      </div>

      {/* Product rows */}
      <div className="divide-y divide-border">
        {all.length === 0 && (
          <div className="px-5 py-16 text-center">
            <Package className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Belum ada produk. Klik <b>Tambah Produk</b> untuk memulai.</p>
          </div>
        )}
        {all.map((p) => {
          const ov = overrides[p.id];
          const isCustom = customIds.has(p.id);
          const keysCount = p.variants.reduce((s, v) => s + getStockKeys(p.id, v.id).length, 0);
          const isPatched = !!ov && (!!ov.extraVariants?.length || !!ov.removedVariantIds?.length || !!ov.variantPrices);
          return (
            <div key={p.id + ":" + tick} className="group flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors">
              <img src={ov?.imageUrl || p.imageUrl} alt={p.title} className="w-12 h-12 rounded-lg object-cover border border-border shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold truncate">{ov?.title || p.title}</span>
                  {isCustom && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-400">Custom</span>
                  )}
                  {isPatched && !isCustom && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-blue-500/15 border border-blue-500/30 text-blue-400">Diubah</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                  <span>{ov?.publisher || p.publisher}</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="px-1.5 py-0.5 rounded bg-muted text-foreground/80">{getCategoryLabel(ov?.category || p.category)}</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="text-blue-400">{p.variants.length} varian</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className={keysCount === 0 ? "text-rose-400" : keysCount < 5 ? "text-amber-400" : "text-emerald-400"}>{keysCount} stok</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => onEdit(p)}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-background border border-border hover:border-primary hover:text-primary transition-colors flex items-center gap-1.5"
                >
                  <SettingsIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Ubah</span>
                </button>
                <button
                  onClick={() => setConfirmId(p.id)}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-background border border-border text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/50 transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Hapus</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {creating && (
        <NewProductModal
          onClose={() => setCreating(false)}
          onCreated={(p) => { setCreating(false); refreshLocal(); onEdit(p); }}
        />
      )}
      {managingCats && (
        <CategoryManagerModal onClose={() => { setManagingCats(false); refreshLocal(); }} />
      )}
      {managingPubs && (
        <PublisherManagerModal onClose={() => { setManagingPubs(false); refreshLocal(); }} />
      )}
      {confirmId && (
        <ConfirmDialog
          message={`Hapus produk "${all.find((p) => p.id === confirmId)?.title}"? Aksi ini menyembunyikan produk dari toko.`}
          onConfirm={confirmDelete}
          onCancel={() => setConfirmId(null)}
        />
      )}
    </div>
  );
}

function StatChip({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number | string; accent: string }) {
  return (
    <div className="px-4 py-3 flex items-center gap-3 border-r border-border last:border-r-0">
      <span className={`${accent}`}>{icon}</span>
      <div className="flex flex-col">
        <span className="text-[11px] text-muted-foreground leading-none">{label}</span>
        <span className={`text-base font-bold ${accent} leading-tight mt-1`}>{value}</span>
      </div>
    </div>
  );
}

// ─── Category Manager Modal ───────────────────────────────────────────────
function CategoryManagerModal({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<CategoryDef[]>(getCategories());
  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null);

  const refresh = () => setList(getCategories());

  const handleAdd = () => {
    const c = addCategory(newLabel);
    if (c) { setNewLabel(""); refresh(); }
  };
  const handleStartEdit = (c: CategoryDef) => { setEditingId(c.id); setEditingValue(c.label); };
  const handleSaveEdit = () => {
    if (editingId && renameCategory(editingId, editingValue)) {
      setEditingId(null); refresh();
    }
  };
  const handleDelete = (id: string) => { deleteCategory(id); setConfirmDelId(null); refresh(); };

  return (
    <div className="fixed inset-0 z-[230] flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-primary" />
            <p className="font-bold text-sm">Kelola Kategori Produk</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Tambah Kategori Baru</label>
            <div className="flex gap-2">
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
                placeholder="Contoh: Skin Bundle"
                className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                onClick={handleAdd}
                disabled={!newLabel.trim()}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:brightness-110 disabled:opacity-40 inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />Tambah
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Daftar Kategori ({list.length})</label>
            <div className="space-y-1.5">
              {list.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Belum ada kategori.</p>
              )}
              {list.map((c) => (
                <div key={c.id} className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2">
                  {editingId === c.id ? (
                    <>
                      <input
                        autoFocus
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleSaveEdit(); if (e.key === "Escape") setEditingId(null); }}
                        className="flex-1 bg-transparent border border-primary/40 rounded-md px-2 py-1 text-sm focus:outline-none"
                      />
                      <button onClick={handleSaveEdit} className="px-2.5 py-1 text-xs font-bold rounded-md bg-primary text-primary-foreground hover:brightness-110">Simpan</button>
                      <button onClick={() => setEditingId(null)} className="px-2.5 py-1 text-xs font-bold rounded-md border border-border hover:bg-muted">Batal</button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{c.label}</p>
                        <p className="text-[11px] text-muted-foreground truncate">id: {c.id}</p>
                      </div>
                      <button onClick={() => handleStartEdit(c)} className="px-2.5 py-1 text-xs font-bold rounded-md border border-border hover:border-primary hover:text-primary">Ubah</button>
                      <button onClick={() => setConfirmDelId(c.id)} className="px-2 py-1 text-xs rounded-md border border-border text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-background/50">
          <button onClick={onClose} className="px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:brightness-110">Selesai</button>
        </div>

        {confirmDelId && (
          <ConfirmDialog
            message={`Hapus kategori "${list.find((c) => c.id === confirmDelId)?.label}"? Produk yang masih memakai kategori ini tidak ikut terhapus, tapi kategorinya tidak akan muncul lagi.`}
            onConfirm={() => handleDelete(confirmDelId)}
            onCancel={() => setConfirmDelId(null)}
          />
        )}
      </div>
    </div>
  );
}

// ─── Publisher Manager Modal ──────────────────────────────────────────────
function PublisherManagerModal({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<string[]>(getPublishers());
  const [newName, setNewName] = useState("");
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [confirmDelName, setConfirmDelName] = useState<string | null>(null);

  const refresh = () => setList(getPublishers());

  const handleAdd = () => {
    if (addPublisher(newName)) { setNewName(""); refresh(); }
  };
  const handleStartEdit = (n: string) => { setEditingName(n); setEditingValue(n); };
  const handleSaveEdit = () => {
    if (editingName && renamePublisher(editingName, editingValue)) {
      setEditingName(null); refresh();
    }
  };
  const handleDelete = (n: string) => { deletePublisher(n); setConfirmDelName(null); refresh(); };

  return (
    <div className="fixed inset-0 z-[230] flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Boxes className="w-4 h-4 text-primary" />
            <p className="font-bold text-sm">Kelola Publisher</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Tambah Publisher Baru</label>
            <div className="flex gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
                placeholder="Contoh: Tencent"
                className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                onClick={handleAdd}
                disabled={!newName.trim()}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:brightness-110 disabled:opacity-40 inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />Tambah
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Daftar Publisher ({list.length})</label>
            <div className="space-y-1.5">
              {list.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Belum ada publisher.</p>
              )}
              {list.map((n) => (
                <div key={n} className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2">
                  {editingName === n ? (
                    <>
                      <input
                        autoFocus
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleSaveEdit(); if (e.key === "Escape") setEditingName(null); }}
                        className="flex-1 bg-transparent border border-primary/40 rounded-md px-2 py-1 text-sm focus:outline-none"
                      />
                      <button onClick={handleSaveEdit} className="px-2.5 py-1 text-xs font-bold rounded-md bg-primary text-primary-foreground hover:brightness-110">Simpan</button>
                      <button onClick={() => setEditingName(null)} className="px-2.5 py-1 text-xs font-bold rounded-md border border-border hover:bg-muted">Batal</button>
                    </>
                  ) : (
                    <>
                      <p className="flex-1 text-sm font-bold truncate">{n}</p>
                      <button onClick={() => handleStartEdit(n)} className="px-2.5 py-1 text-xs font-bold rounded-md border border-border hover:border-primary hover:text-primary">Ubah</button>
                      <button onClick={() => setConfirmDelName(n)} className="px-2 py-1 text-xs rounded-md border border-border text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-background/50">
          <button onClick={onClose} className="px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:brightness-110">Selesai</button>
        </div>

        {confirmDelName && (
          <ConfirmDialog
            message={`Hapus publisher "${confirmDelName}"? Produk yang masih memakai publisher ini tidak ikut terhapus, tapi nama publisher-nya tetap tampil.`}
            onConfirm={() => handleDelete(confirmDelName)}
            onCancel={() => setConfirmDelName(null)}
          />
        )}
      </div>
    </div>
  );
}

// ─── Reusable Field ────────────────────────────────────────────────────────
function FormField({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}

// ─── New Product Modal ────────────────────────────────────────────────────
function NewProductModal({ onClose, onCreated }: { onClose: () => void; onCreated: (p: Product) => void }) {
  const cats = getCategories();
  const pubs = getPublishers();
  const [title, setTitle] = useState("");
  const [publisher, setPublisher] = useState(pubs[0] || "");
  const [category, setCategory] = useState<ProductCategory>(cats[0]?.id || "apkmod");
  const [imageUrl, setImageUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setUploading(true);
    try {
      const compressed = await compressImageFileShared(f);
      setImageUrl(compressed);
    } catch {
      const r = new FileReader();
      r.onloadend = () => setImageUrl(r.result as string);
      r.readAsDataURL(f);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const canCreate = title.trim().length >= 2 && publisher.trim().length >= 1 && category.trim().length >= 1 && !uploading;

  const handleCreate = () => {
    if (!canCreate) return;
    setCreateError(null);
    try {
      const id = makeSlug(title, "produk");
      const firstVariantId = makeSlug("default", "var");
      const finalPublisher = ensurePublisher(publisher);
      const finalCategory = ensureCategory(category);
      const newP: Product = {
        id,
        title: title.trim(),
        publisher: finalPublisher,
        category: finalCategory,
        imageUrl: imageUrl || `https://via.placeholder.com/256x256/1a1a2e/aaff00?text=${encodeURIComponent(title.slice(0, 4).toUpperCase())}`,
        price: 10000,
        variants: [
          { id: firstVariantId, label: "Default", price: 10000 },
        ],
        soldCount: 0,
      };
      const created = addExtraProduct(newP);
      onCreated(created);
    } catch (err: any) {
      setCreateError(
        "Gagal menyimpan: penyimpanan browser penuh. Hapus beberapa produk lama atau pakai foto lebih kecil, lalu coba lagi."
      );
      console.error("[admin] addExtraProduct failed", err);
    }
  };

  return (
    <div className="fixed inset-0 z-[230] flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" />
            <p className="font-bold text-sm">Tambah Produk Baru</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="overflow-y-auto p-5 space-y-4">
          <div className="flex gap-4 items-start">
            <div>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              <button type="button" onClick={() => fileRef.current?.click()} className="block">
                {imageUrl ? (
                  <img src={imageUrl} alt="" className="w-24 h-24 rounded-xl object-cover border border-border hover:border-primary/60 transition-colors" />
                ) : (
                  <div className="w-24 h-24 rounded-xl border-2 border-dashed border-border hover:border-primary/60 flex flex-col items-center justify-center text-muted-foreground hover:text-primary transition-colors">
                    <ImageIcon className="w-6 h-6" />
                    <span className="text-[10px] mt-1">Upload</span>
                  </div>
                )}
                {imageUrl && <p className="text-[11px] text-muted-foreground text-center mt-1.5 hover:text-primary">Ganti foto</p>}
              </button>
            </div>
            <div className="flex-1 space-y-3">
              <FormField label="Nama Produk" value={title} onChange={setTitle} placeholder="Mobile Legends" />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Publisher</label>
            <input
              list="publishers-list"
              value={publisher}
              onChange={(e) => setPublisher(e.target.value)}
              placeholder="Pilih atau ketik baru"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <datalist id="publishers-list">
              {pubs.map((p) => <option key={p} value={p} />)}
            </datalist>
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Kategori</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {cats.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <p className="text-[11px] text-muted-foreground mt-1">Kelola kategori dari tombol <b>Kategori</b> di header.</p>
          </div>

          <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg px-3 py-2.5 text-xs text-blue-300/90 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>Produk dibuat dengan 1 varian default (Rp 10.000). Anda bisa menambah/ubah varian setelah produk dibuat.</span>
          </div>

          {uploading && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2 text-xs text-amber-300">
              Mengoptimalkan foto…
            </div>
          )}
          {createError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5 text-xs text-red-300">
              {createError}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-background/50">
          <button onClick={onClose} className="px-4 py-2 text-xs font-bold rounded-lg border border-border hover:bg-muted">Batal</button>
          <button
            onClick={handleCreate}
            disabled={!canCreate}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:brightness-110 disabled:opacity-40 inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />{uploading ? "Memproses..." : "Simpan Produk"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Product Edit Modal (clean, with add/delete variants) ─────────────────
function ProductEditModal({ product, onClose, onSaved }: { product: Product; onClose: () => void; onSaved: () => void }) {
  const initOv = getProductOverrides()[product.id] || {};
  const customIds = new Set(getExtraProducts().map((p) => p.id));
  const isCustom = customIds.has(product.id);
  const cats = getCategories();
  const pubs = getPublishers();
  const [title, setTitle] = useState(initOv.title || product.title);
  const [imageUrl, setImageUrl] = useState(initOv.imageUrl || product.imageUrl);
  const [publisher, setPublisher] = useState(initOv.publisher || product.publisher);
  const [category, setCategory] = useState<ProductCategory>(initOv.category || product.category);
  const [soldCount, setSoldCount] = useState<string>(
    String(typeof initOv.soldCount === "number" ? initOv.soldCount : product.soldCount ?? 0)
  );

  const [removedBaseIds, setRemovedBaseIds] = useState<Set<string>>(
    () => new Set(initOv.removedVariantIds || [])
  );
  const [extraVariants, setExtraVariants] = useState<{ id: string; label: string; price: number }[]>(
    () => (initOv.extraVariants || []).map((v) => ({ id: v.id, label: v.label, price: v.price }))
  );

  const [variantPrices, setVariantPrices] = useState<Record<string, number>>(() => {
    const out: Record<string, number> = {};
    product.variants.forEach((v) => { out[v.id] = initOv.variantPrices?.[v.id] ?? v.price; });
    (initOv.extraVariants || []).forEach((v) => { out[v.id] = initOv.variantPrices?.[v.id] ?? v.price; });
    return out;
  });
  const [variantLabels, setVariantLabels] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    product.variants.forEach((v) => { out[v.id] = initOv.variantLabels?.[v.id] ?? v.label; });
    (initOv.extraVariants || []).forEach((v) => { out[v.id] = initOv.variantLabels?.[v.id] ?? v.label; });
    return out;
  });
  const [stocksByVariant, setStocksByVariant] = useState<Record<string, string[]>>(() => {
    const out: Record<string, string[]> = {};
    product.variants.forEach((v) => { out[v.id] = getStockKeys(product.id, v.id); });
    (initOv.extraVariants || []).forEach((v) => { out[v.id] = getStockKeys(product.id, v.id); });
    return out;
  });
  const [bulkInput, setBulkInput] = useState<Record<string, string>>({});
  const [confirmDeleteVarId, setConfirmDeleteVarId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const baseVisible = product.variants.filter((v) => !removedBaseIds.has(v.id));
  const allVariants: { id: string; defaultLabel: string; isExtra: boolean; baseRemovable: boolean }[] = [
    ...baseVisible.map((v) => ({ id: v.id, defaultLabel: v.label, isExtra: false, baseRemovable: true })),
    ...extraVariants.map((v) => ({ id: v.id, defaultLabel: v.label, isExtra: true, baseRemovable: false })),
  ];

  const handleAddKeys = (variantId: string) => {
    const raw = (bulkInput[variantId] || "").trim();
    if (!raw) return;
    const newKeys = raw.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    setStocksByVariant({ ...stocksByVariant, [variantId]: [...(stocksByVariant[variantId] || []), ...newKeys] });
    setBulkInput({ ...bulkInput, [variantId]: "" });
  };
  const handleRemoveKey = (variantId: string, idx: number) => {
    const arr = [...(stocksByVariant[variantId] || [])];
    arr.splice(idx, 1);
    setStocksByVariant({ ...stocksByVariant, [variantId]: arr });
  };

  const handleAddVariant = () => {
    const newId = makeSlug("varian", "var");
    const newVar = { id: newId, label: "Item Baru", price: 10000 };
    setExtraVariants([...extraVariants, newVar]);
    setVariantPrices({ ...variantPrices, [newId]: 10000 });
    setVariantLabels({ ...variantLabels, [newId]: "Item Baru" });
    setStocksByVariant({ ...stocksByVariant, [newId]: [] });
  };

  const handleDeleteVariant = (vid: string, isExtra: boolean) => {
    if (isExtra) {
      setExtraVariants(extraVariants.filter((v) => v.id !== vid));
    } else {
      setRemovedBaseIds(new Set([...Array.from(removedBaseIds), vid]));
    }
    setStocksByVariant({ ...stocksByVariant, [vid]: [] });
    setConfirmDeleteVarId(null);
  };

  const [editUploading, setEditUploading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setEditUploading(true);
    try {
      const compressed = await compressImageFileShared(f);
      setImageUrl(compressed);
    } catch {
      const r = new FileReader();
      r.onloadend = () => setImageUrl(r.result as string);
      r.readAsDataURL(f);
    } finally {
      setEditUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSave = () => {
    setSaveError(null);
    try {
      const finalPublisher = ensurePublisher(publisher);
      const finalCategory = ensureCategory(category);
      const parsedSold = Math.max(0, Math.floor(Number(soldCount)));
      const finalSold = Number.isFinite(parsedSold) ? parsedSold : 0;
      if (isCustom) {
        const list = getExtraProducts();
        const idx = list.findIndex((p) => p.id === product.id);
        if (idx >= 0) {
          const merged = [
            ...product.variants.filter((v) => !removedBaseIds.has(v.id)),
            ...extraVariants,
          ].map((v) => ({
            ...v,
            label: variantLabels[v.id] || v.label,
            price: variantPrices[v.id] ?? v.price,
          }));
          list[idx] = {
            ...list[idx],
            title,
            imageUrl,
            publisher: finalPublisher,
            category: finalCategory,
            variants: merged,
            price: merged[0]?.price ?? list[idx].price,
            soldCount: finalSold,
          };
          saveExtraProducts(list);
        }
      } else {
        const finalExtras = extraVariants.map((v) => ({
          id: v.id,
          label: variantLabels[v.id] || v.label,
          price: variantPrices[v.id] ?? v.price,
        }));
        setProductOverride(product.id, {
          title,
          imageUrl,
          publisher: finalPublisher,
          category: finalCategory,
          variantPrices,
          variantLabels,
          extraVariants: finalExtras,
          removedVariantIds: Array.from(removedBaseIds),
          soldCount: finalSold,
        });
      }
      Object.entries(stocksByVariant).forEach(([vid, keys]) => setStockKeys(product.id, vid, keys));
      onSaved();
    } catch (err: any) {
      setSaveError(
        "Gagal menyimpan: penyimpanan browser penuh. Hapus beberapa produk lama atau pakai foto lebih kecil, lalu coba lagi."
      );
      console.error("[admin] save product failed", err);
    }
  };

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            <SettingsIcon className="w-4 h-4 text-primary shrink-0" />
            <p className="font-bold text-sm truncate">Edit Produk</p>
            {isCustom && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-400">Custom</span>
            )}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto p-5 space-y-5">
          {/* Image + main fields */}
          <div className="flex gap-4 items-start">
            <div>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              <button onClick={() => fileRef.current?.click()} className="block">
                <img src={imageUrl} alt={title} className="w-24 h-24 rounded-xl object-cover border border-border hover:border-primary/60 transition-colors" />
                <p className="text-[11px] text-muted-foreground text-center mt-1.5 hover:text-primary">Ganti foto</p>
              </button>
            </div>
            <div className="flex-1 space-y-3 min-w-0">
              <FormField label="Nama Produk" value={title} onChange={setTitle} />
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Publisher</label>
                <input
                  list="edit-publishers-list"
                  value={publisher}
                  onChange={(e) => setPublisher(e.target.value)}
                  placeholder="Moonton"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <datalist id="edit-publishers-list">
                  {pubs.map((p) => <option key={p} value={p} />)}
                </datalist>
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Kategori</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  {!cats.some((c) => c.id === category) && <option value={category}>{category} (tidak terdaftar)</option>}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  Total Penjualan
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={soldCount}
                  onChange={(e) => setSoldCount(e.target.value)}
                  placeholder="0"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Angka yang ditampilkan di kartu produk sebagai &quot;Terjual&quot;.
                </p>
              </div>
            </div>
          </div>

          {/* Variants */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5" /> Varian Produk ({allVariants.length})
              </p>
              <button
                onClick={handleAddVariant}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-primary/15 border border-primary/40 text-primary hover:bg-primary/25 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />Tambah Varian
              </button>
            </div>

            {allVariants.length === 0 && (
              <div className="text-center py-8 text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                Belum ada varian — klik <span className="text-primary font-bold">Tambah Varian</span>.
              </div>
            )}

            {allVariants.map((vmeta) => {
              const v = { id: vmeta.id, label: variantLabels[vmeta.id] ?? vmeta.defaultLabel };
              return (
                <div key={v.id} className="bg-background border border-border rounded-xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-3 sm:items-end flex-1">
                      <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                          Nama Varian
                        </label>
                        <input
                          value={variantLabels[v.id] ?? ""}
                          onChange={(e) => setVariantLabels({ ...variantLabels, [v.id]: e.target.value })}
                          placeholder="Contoh: 86 Diamonds"
                          className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        {vmeta.isExtra && <p className="text-[11px] text-amber-400 mt-1">Varian baru</p>}
                      </div>
                      <div>
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Harga (Rp)</label>
                        <input
                          type="number"
                          value={variantPrices[v.id] ?? 0}
                          onChange={(e) => setVariantPrices({ ...variantPrices, [v.id]: Number(e.target.value) || 0 })}
                          className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => setConfirmDeleteVarId(v.id)}
                      title="Hapus varian"
                      className="mt-7 shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5" />Stok Key ({(stocksByVariant[v.id] || []).length})
                    </p>
                    <div className="flex flex-wrap gap-1.5 mb-2 min-h-[24px]">
                      {(stocksByVariant[v.id] || []).length === 0 ? (
                        <span className="text-xs text-muted-foreground italic">Kosong — sistem akan auto-generate saat order disetujui.</span>
                      ) : (stocksByVariant[v.id] || []).map((k, i) => (
                        <span key={i} className="inline-flex items-center gap-1 bg-primary/10 border border-primary/30 text-primary text-xs font-bold px-2 py-1 rounded-md">
                          {k}
                          <button onClick={() => handleRemoveKey(v.id, i)} className="hover:text-destructive"><X className="w-3 h-3" /></button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={bulkInput[v.id] || ""}
                        onChange={(e) => setBulkInput({ ...bulkInput, [v.id]: e.target.value })}
                        placeholder="KEY-001, KEY-002, ..."
                        onKeyDown={(e) => { if (e.key === "Enter") handleAddKeys(v.id); }}
                        className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <button onClick={() => handleAddKeys(v.id)} className="px-3 py-2 bg-primary/10 border border-primary/30 text-primary text-xs font-bold rounded-lg hover:bg-primary/20 flex items-center gap-1.5">
                        <Plus className="w-3.5 h-3.5" />Tambah
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {(editUploading || saveError) && (
          <div className="px-5 pb-2 space-y-2">
            {editUploading && (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2 text-xs text-amber-300">
                Mengoptimalkan foto…
              </div>
            )}
            {saveError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5 text-xs text-red-300">
                {saveError}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-background/50">
          <button onClick={onClose} className="px-4 py-2 text-xs font-bold rounded-lg border border-border hover:bg-muted">Batal</button>
          <button
            onClick={handleSave}
            disabled={editUploading}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:brightness-110 disabled:opacity-40 inline-flex items-center gap-1.5"
          >
            <CheckCircle className="w-3.5 h-3.5" />{editUploading ? "Memproses..." : "Simpan Perubahan"}
          </button>
        </div>

        {confirmDeleteVarId && (() => {
          const meta = allVariants.find((v) => v.id === confirmDeleteVarId);
          const label = variantLabels[confirmDeleteVarId] || meta?.defaultLabel || confirmDeleteVarId;
          return (
            <ConfirmDialog
              message={`Hapus varian "${label}"? Semua stok key untuk varian ini juga ikut dihapus.`}
              onConfirm={() => handleDeleteVariant(confirmDeleteVarId, !!meta?.isExtra)}
              onCancel={() => setConfirmDeleteVarId(null)}
            />
          );
        })()}
      </div>
    </div>
  );
}


function EmptyState({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="text-center py-16 text-muted-foreground">
      <div className="w-12 h-12 mx-auto mb-3 opacity-40 flex items-center justify-center [&>*]:w-12 [&>*]:h-12">{icon}</div>
      <p className="font-bold">{title}</p>
      <p className="text-sm mt-1">{sub}</p>
    </div>
  );
}

function OrderCard({ order, onVerify, onReject, onViewProof, onDelete, showDelete }: {
  order: Order;
  onVerify: (id: string) => void;
  onReject: (id: string) => void;
  onViewProof: (o: Order) => void;
  onDelete: (id: string) => void;
  showDelete?: boolean;
}) {
  const sc = STATUS_LABELS[order.status];
  return (
    <div className="bg-card/80 backdrop-blur border border-border rounded-2xl overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between border-b border-border/60">
        <div>
          <p className="font-bold text-sm">{order.productName} · <span className="font-normal text-muted-foreground">{order.variantLabel}</span></p>
          <p className="text-xs text-muted-foreground mt-0.5">@{order.username} · {new Date(order.createdAt).toLocaleString("id-ID")}</p>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${sc.bg} ${sc.color}`}>{sc.label}</span>
      </div>
      <div className="px-4 py-3 grid grid-cols-2 gap-2 text-sm">
        <div><span className="text-muted-foreground">Order ID: </span><code className="font-mono text-xs font-bold">{order.id}</code></div>
        <div><span className="text-muted-foreground">Pembeli: </span><span className="font-medium">{order.buyerName}</span></div>
        <div>
          <span className="text-muted-foreground">Harga: </span>
          <span className="font-bold text-primary">{order.paymentMethod === "usdt" ? `$${order.amountUSDT} USDT` : formatCurrency(order.variantPrice)}</span>
        </div>
        <div><span className="text-muted-foreground">Metode: </span><span className="font-semibold uppercase">{order.paymentMethod}</span></div>
      </div>

      {order.key && (
        <div className="px-4 pb-3">
          <div className="bg-green-500/5 border border-green-500/20 rounded-xl px-3 py-2 text-xs flex items-center justify-between">
            <span><span className="text-muted-foreground">Key: </span><code className="font-mono text-primary font-bold">{order.key}</code></span>
            <button onClick={() => navigator.clipboard.writeText(order.key!)} className="text-muted-foreground hover:text-foreground text-xs font-bold ml-2 hover:underline">Salin</button>
          </div>
        </div>
      )}

      {(order.status === "pending_verify" || showDelete) && (
        <div className="px-4 pb-4 flex flex-wrap gap-2">
          {order.status === "pending_verify" && order.proofFileBase64 && (
            <button onClick={() => onViewProof(order)} className="flex items-center gap-1.5 px-3 py-2 bg-muted border border-border rounded-xl text-xs font-bold hover:bg-muted/80">
              <Eye className="w-3.5 h-3.5" /> Lihat Bukti
            </button>
          )}
          {order.status === "pending_verify" && (
            <>
              <button onClick={() => onVerify(order.id)} className="flex items-center gap-1.5 px-4 py-2 bg-green-500/15 border border-green-500/30 text-green-400 rounded-xl text-xs font-bold hover:bg-green-500/25">
                <CheckCircle className="w-3.5 h-3.5" /> Verifikasi
              </button>
              <button onClick={() => onReject(order.id)} className="flex items-center gap-1.5 px-4 py-2 bg-destructive/10 border border-destructive/30 text-destructive rounded-xl text-xs font-bold hover:bg-destructive/20">
                <XCircle className="w-3.5 h-3.5" /> Tolak
              </button>
            </>
          )}
          {showDelete && (order.status === "verified" || order.status === "cancelled") && (
            <button onClick={() => onDelete(order.id)} className="flex items-center gap-1.5 px-3 py-2 bg-destructive/10 border border-destructive/30 text-destructive rounded-xl text-xs font-bold hover:bg-destructive/20 ml-auto">
              <Trash2 className="w-3.5 h-3.5" /> Hapus
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Coupon Manager ───────────────────────────────────────────────────────
function CouponManager() {
  const [list, setList] = useState<Coupon[]>(getCoupons());
  const [code, setCode] = useState("");
  const [type, setType] = useState<Coupon["type"]>("percent");
  const [value, setValue] = useState<number>(10);
  const [maxRedemptions, setMaxRedemptions] = useState<number>(0);
  const [perUserLimit, setPerUserLimit] = useState<number>(1);
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [active, setActive] = useState(true);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const refresh = () => setList(getCoupons());

  const reset = () => {
    setCode(""); setType("percent"); setValue(10);
    setMaxRedemptions(0); setPerUserLimit(1);
    setExpiresAt(""); setActive(true); setEditing(null);
  };

  const handleSave = () => {
    const c = code.trim().toUpperCase();
    if (!c) return alert("Kode kupon wajib diisi.");
    if (value <= 0) return alert("Nilai diskon harus > 0.");
    if (type === "percent" && value > 100) return alert("Persentase maks 100%.");
    upsertCoupon({
      code: c,
      type,
      value,
      maxRedemptions,
      perUserLimit,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      active,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
    refresh();
    reset();
  };

  const handleEdit = (c: Coupon) => {
    setEditing(c.code);
    setCode(c.code);
    setType(c.type);
    setValue(c.value);
    setMaxRedemptions(c.maxRedemptions);
    setPerUserLimit(c.perUserLimit);
    setExpiresAt(c.expiresAt ? c.expiresAt.slice(0, 10) : "");
    setActive(c.active);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = (c: Coupon) => {
    if (!confirm(`Hapus kupon ${c.code}?`)) return;
    deleteCoupon(c.code);
    if (editing === c.code) reset();
    refresh();
  };

  const fmt = (n: number) => n.toLocaleString("id-ID");

  return (
    <div className="space-y-5">
      {/* Form */}
      <div className="bg-card/80 backdrop-blur border border-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="font-bold text-sm flex items-center gap-2">
            <Tag className="w-4 h-4 text-primary" />
            {editing ? `Edit Kupon · ${editing}` : "Buat Kupon Baru"}
          </p>
          {editing && (
            <button onClick={reset} className="text-xs text-muted-foreground hover:text-foreground">
              Batal edit
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-1.5 block">
              Kode Kupon
            </label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              disabled={!!editing}
              placeholder="HEMAT10"
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
            />
          </div>
          <div>
            <label className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-1.5 block">
              Tipe Diskon
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType("percent")}
                className={`py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1 ${
                  type === "percent"
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                <Percent className="w-3.5 h-3.5" /> Persen
              </button>
              <button
                type="button"
                onClick={() => setType("fixed")}
                className={`py-2 rounded-xl border text-xs font-bold ${
                  type === "fixed"
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                Rp Potong
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-1.5 block">
              Nilai {type === "percent" ? "(%)" : "(IDR)"}
            </label>
            <input
              type="number"
              value={value}
              onChange={(e) => setValue(Number(e.target.value))}
              min={1}
              max={type === "percent" ? 100 : undefined}
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-1.5 block">
              Maks. Total Pakai
            </label>
            <input
              type="number"
              value={maxRedemptions}
              onChange={(e) => setMaxRedemptions(Math.max(0, Number(e.target.value)))}
              min={0}
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="text-[10px] text-muted-foreground mt-1">0 = tanpa batas</p>
          </div>
          <div>
            <label className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-1.5 block">
              Maks. per User
            </label>
            <input
              type="number"
              value={perUserLimit}
              onChange={(e) => setPerUserLimit(Math.max(0, Number(e.target.value)))}
              min={0}
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="text-[10px] text-muted-foreground mt-1">0 = tanpa batas</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-1.5 block">
              Berlaku Hingga (opsional)
            </label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-sm font-bold">Aktif</span>
            </label>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="px-5 py-2.5 bg-primary text-primary-foreground font-bold text-sm rounded-xl hover:brightness-110 transition-all"
          >
            {saved ? "✓ Tersimpan!" : editing ? "Simpan Perubahan" : "Buat Kupon"}
          </button>
        </div>
      </div>

      {/* List */}
      <div className="bg-card/80 backdrop-blur border border-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <p className="font-bold text-sm">Daftar Kupon ({list.length})</p>
          <button
            onClick={refresh}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
            title="Muat ulang"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
        {list.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Belum ada kupon. Buat kupon pertama di atas.
          </div>
        ) : (
          <ul className="divide-y divide-border/60 max-h-[520px] overflow-y-auto">
            {list.map((c) => {
              const expired = c.expiresAt && new Date(c.expiresAt).getTime() < Date.now();
              const exhausted = c.maxRedemptions > 0 && c.totalRedemptions >= c.maxRedemptions;
              return (
                <li key={c.code} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="font-mono text-sm font-bold text-primary">{c.code}</code>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                          c.active && !expired && !exhausted
                            ? "border-green-500/30 text-green-400 bg-green-500/10"
                            : "border-muted text-muted-foreground bg-muted/40"
                        }`}
                      >
                        {expired ? "EXPIRED" : exhausted ? "HABIS" : c.active ? "AKTIF" : "OFF"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {c.type === "percent" ? `${c.value}% off` : `Rp ${fmt(c.value)} potong`}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Pakai: {fmt(c.totalRedemptions)}
                      {c.maxRedemptions > 0 ? ` / ${fmt(c.maxRedemptions)}` : ""}
                      {" · "}Per-user: {c.perUserLimit > 0 ? `${c.perUserLimit}x` : "∞"}
                      {c.expiresAt ? ` · Exp ${new Date(c.expiresAt).toLocaleDateString("id-ID")}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleEdit(c)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-border hover:bg-muted"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(c)}
                      className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10"
                      title="Hapus"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── Dashboard Overview ────────────────────────────────────────────────────
function DashboardOverview({
  user, orders, users2, notifs, liveDelta,
  verifiedCount, pendingPayCount, pendingVerifyCount, revenueIDR,
  announcement, activeBroadcast, downloadInfo, onDownload, onGoTo,
}: {
  user: User;
  orders: Order[];
  users2: User[];
  notifs: PurchaseNotif[];
  liveDelta: { orders: number; verified: number; pending: number; revenueIDR: number };
  verifiedCount: number;
  pendingPayCount: number;
  pendingVerifyCount: number;
  revenueIDR: number;
  announcement: string;
  activeBroadcast: Broadcast | null;
  downloadInfo: { size?: number; updatedAt?: string };
  onDownload: () => void;
  onGoTo: (t: AdminTab) => void;
}) {
  const fmt = (n: number) => n.toLocaleString("id-ID");
  const totalOrders   = DUMMY.TOTAL    + orders.length    + liveDelta.orders;
  const totalVerified = DUMMY.VERIFIED + verifiedCount    + liveDelta.verified;
  const totalPending  = DUMMY.PENDING  + pendingPayCount  + liveDelta.pending;
  const totalRevenue  = revenueIDR + liveDelta.revenueIDR;

  // 7-day order trend (uses real orders, fills with synthetic baseline)
  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i)); d.setHours(0, 0, 0, 0);
    return d;
  });
  const orderTrend = days.map((d) => {
    const dayMs = d.getTime();
    const next = dayMs + 86_400_000;
    const real = orders.filter((o) => {
      const t = new Date(o.createdAt).getTime();
      return t >= dayMs && t < next;
    }).length;
    // baseline shaped wave so chart looks alive
    const idx = days.indexOf(d);
    const baseline = Math.round(2200 + Math.sin((dayMs / 86_400_000) * 0.9) * 320 + idx * 90);
    return {
      label: d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
      orders: baseline + real * 8,
    };
  });
  const revenueTrend = orderTrend.map((d) => ({
    label: d.label,
    revenue: Math.round(d.orders * (35000 + Math.random() * 6000)),
  }));

  // Donut: status verifikasi
  const donutData = [
    { name: "Terverifikasi", value: totalVerified, color: "#22c55e" },
    { name: "Belum Bayar",   value: totalPending,  color: "#facc15" },
    { name: "Menunggu",      value: pendingVerifyCount + Math.round(totalOrders * 0.012), color: "#a855f7" },
    { name: "Dibatalkan",    value: Math.round(totalOrders * 0.002), color: "#ef4444" },
  ];
  const donutTotal = donutData.reduce((s, d) => s + d.value, 0);

  const statCards = [
    {
      label: "TOTAL ORDER", value: fmt(totalOrders), delta: "+12.5% dari kemarin",
      icon: <ShoppingBag className="w-5 h-5" />, gradient: "from-purple-500/30 to-purple-700/10", iconBg: "bg-purple-500/20 text-purple-300",
    },
    {
      label: "TERVERIFIKASI", value: fmt(totalVerified), delta: "+11.2% dari kemarin",
      icon: <CheckCircle className="w-5 h-5" />, gradient: "from-green-500/25 to-emerald-700/10", iconBg: "bg-green-500/20 text-green-300",
    },
    {
      label: "BELUM BAYAR", value: fmt(totalPending), delta: "−4.3% dari kemarin", deltaNeg: true,
      icon: <Clock className="w-5 h-5" />, gradient: "from-yellow-500/25 to-orange-700/10", iconBg: "bg-yellow-500/20 text-yellow-300",
    },
    {
      label: "PENDAPATAN", value: formatCurrency(totalRevenue), delta: "+8.7% dari kemarin", small: true,
      icon: <DollarSign className="w-5 h-5" />, gradient: "from-fuchsia-500/25 to-pink-700/10", iconBg: "bg-fuchsia-500/20 text-fuchsia-300",
    },
  ];

  const recentOrders = orders.slice(0, 6);
  const recentActivity: { type: "order" | "pay" | "verify" | "user" | "system"; text: string; sub: string; time: string; }[] = [];
  notifs.slice(0, 3).forEach((n) => recentActivity.push({
    type: "order",
    text: `Order baru dari @${n.username}`,
    sub: n.productName,
    time: timeAgo(n.createdAt),
  }));
  orders.filter((o) => o.status === "verified" || o.status === "paid").slice(0, 2).forEach((o) => recentActivity.push({
    type: "pay",
    text: `Pembayaran berhasil ${o.id}`,
    sub: `+${formatCurrency(o.finalPriceIDR ?? o.variantPrice)}`,
    time: timeAgo(o.updatedAt),
  }));
  orders.filter((o) => o.status === "pending_verify").slice(0, 1).forEach((o) => recentActivity.push({
    type: "verify",
    text: `Order ${o.id} menunggu verifikasi`,
    sub: o.productName,
    time: timeAgo(o.updatedAt),
  }));
  if (users2.length > 0) {
    const last = users2[users2.length - 1];
    recentActivity.push({
      type: "user",
      text: `User baru mendaftar: ${last.username}`,
      sub: "Akun aktif",
      time: timeAgo(last.createdAt || new Date().toISOString()),
    });
  }

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 11) return "Selamat pagi";
    if (h < 15) return "Selamat siang";
    if (h < 18) return "Selamat sore";
    return "Selamat malam";
  })();

  return (
    <div className="space-y-5">
      {/* Welcome + System Status row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Welcome */}
        <div className="lg:col-span-2 relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-purple-950/40 p-6">
          <div className="absolute -right-10 -top-10 w-64 h-64 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
          <div className="relative">
            <p className="text-sm text-muted-foreground">{greeting},</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold mt-1 bg-gradient-to-r from-primary via-fuchsia-400 to-purple-300 bg-clip-text text-transparent">
              {user.username} 👋
            </h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm">
              Berikut ringkasan statistik dan aktivitas sistem hari ini.
            </p>
            <div className="flex gap-2 mt-4 flex-wrap">
              <button onClick={() => onGoTo("orders")}
                className="px-3.5 py-2 text-xs font-bold rounded-xl bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25">
                Lihat Order
              </button>
              <button onClick={() => onGoTo("download")}
                className="px-3.5 py-2 text-xs font-bold rounded-xl border border-border hover:bg-muted text-foreground flex items-center gap-1.5">
                <FileArchive className="w-3.5 h-3.5" /> Download Project
              </button>
            </div>
          </div>
        </div>

        {/* System Status */}
        <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur p-5">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-green-500/15 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-green-400" />
            </div>
            <div>
              <p className="font-bold text-sm">Sistem Status</p>
              <p className="text-[10px] text-muted-foreground">Semua sistem berjalan normal</p>
            </div>
          </div>
          <div className="h-14 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={orderTrend}>
                <defs>
                  <linearGradient id="ssg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="orders" stroke="#22c55e" strokeWidth={2} fill="url(#ssg)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] mt-2">
            {[
              { label: "Server",   icon: <Server   className="w-3 h-3" /> },
              { label: "Database", icon: <Database className="w-3 h-3" /> },
              { label: "Payment",  icon: <CreditCard className="w-3 h-3" /> },
              { label: "API",      icon: <Cloud    className="w-3 h-3" /> },
            ].map((s) => (
              <div key={s.label} className="flex items-center justify-between bg-muted/30 rounded-lg px-2 py-1.5">
                <span className="flex items-center gap-1.5 text-muted-foreground">{s.icon}{s.label}</span>
                <span className="text-green-400 flex items-center gap-1 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" /> Online
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4 Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div key={s.label}
            className={`relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br ${s.gradient} p-4`}
          >
            <div className="absolute inset-0 bg-card/70" />
            <div className="relative">
              <div className="flex items-start justify-between">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.iconBg}`}>
                  {s.icon}
                </div>
              </div>
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground mt-3">{s.label}</p>
              <p className={`font-extrabold ${s.small ? "text-lg sm:text-xl" : "text-2xl sm:text-3xl"} mt-0.5`}>{s.value}</p>
              <p className={`text-[11px] mt-1 font-bold flex items-center gap-1 ${s.deltaNeg ? "text-red-400" : "text-green-400"}`}>
                {s.deltaNeg ? "▼" : "▲"} {s.delta}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Order trend */}
        <div className="lg:col-span-2 rounded-2xl border border-border/60 bg-card/80 backdrop-blur p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="font-bold text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Grafik Order</p>
            <span className="text-[10px] text-muted-foreground bg-muted/40 border border-border rounded-full px-2 py-0.5">7 Hari Terakhir</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={orderTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="dot" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a855f7" stopOpacity={1} />
                    <stop offset="100%" stopColor="#7c3aed" stopOpacity={1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="label" stroke="rgba(255,255,255,0.4)" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis stroke="rgba(255,255,255,0.4)" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "rgba(20,20,30,0.9)", border: "1px solid rgba(168,85,247,0.4)", borderRadius: 12, fontSize: 12 }}
                  labelStyle={{ color: "#fff", fontWeight: "bold" }}
                />
                <Line type="monotone" dataKey="orders" stroke="url(#dot)" strokeWidth={2.5} dot={{ r: 4, fill: "#a855f7", stroke: "#fff", strokeWidth: 1.5 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Donut */}
        <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur p-5">
          <p className="font-bold text-sm flex items-center gap-2 mb-3"><Activity className="w-4 h-4 text-primary" /> Status Verifikasi</p>
          <div className="relative h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={donutData} dataKey="value" innerRadius={48} outerRadius={70} paddingAngle={2} stroke="none">
                  {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "rgba(20,20,30,0.9)", border: "1px solid rgba(168,85,247,0.4)", borderRadius: 12, fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-2xl font-extrabold">{fmt(donutTotal)}</p>
              <p className="text-[10px] text-muted-foreground">Total</p>
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            {donutData.map((d) => {
              const pct = donutTotal > 0 ? ((d.value / donutTotal) * 100).toFixed(1) : "0";
              return (
                <div key={d.name} className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                    {d.name}
                  </span>
                  <span className="text-muted-foreground">{fmt(d.value)} <span className="opacity-60">({pct}%)</span></span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent orders + activity row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent orders */}
        <div className="lg:col-span-2 rounded-2xl border border-border/60 bg-card/80 backdrop-blur overflow-hidden">
          <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between">
            <p className="font-bold text-sm flex items-center gap-2"><ShoppingBag className="w-4 h-4 text-primary" /> Order Terbaru</p>
            <button onClick={() => onGoTo("orders")} className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 font-bold">
              Lihat Semua <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          {recentOrders.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Belum ada order.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                    <th className="text-left px-5 py-2.5">ID Order</th>
                    <th className="text-left px-2 py-2.5">Customer</th>
                    <th className="text-left px-2 py-2.5">Produk</th>
                    <th className="text-left px-2 py-2.5">Status</th>
                    <th className="text-right px-5 py-2.5">Waktu</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((o) => {
                    const st = STATUS_LABELS[o.status];
                    return (
                      <tr key={o.id} className="border-t border-border/40 hover:bg-muted/20">
                        <td className="px-5 py-2.5"><code className="text-xs font-mono text-primary">#{o.id}</code></td>
                        <td className="px-2 py-2.5 truncate max-w-[120px]">{o.buyerName}</td>
                        <td className="px-2 py-2.5 truncate max-w-[140px]">{o.productName}</td>
                        <td className="px-2 py-2.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${st.bg} ${st.color}`}>{st.label}</span>
                        </td>
                        <td className="px-5 py-2.5 text-right text-xs text-muted-foreground">{timeAgo(o.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Activity */}
        <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur overflow-hidden">
          <div className="px-5 py-4 border-b border-border/60">
            <p className="font-bold text-sm flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /> Aktivitas Terbaru</p>
          </div>
          {recentActivity.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">Belum ada aktivitas.</div>
          ) : (
            <ul className="divide-y divide-border/40 max-h-96 overflow-y-auto">
              {recentActivity.map((a, i) => {
                const map = {
                  order:  { icon: <ShoppingBag className="w-3.5 h-3.5" />,  bg: "bg-purple-500/15 text-purple-300" },
                  pay:    { icon: <DollarSign className="w-3.5 h-3.5" />,   bg: "bg-green-500/15 text-green-300" },
                  verify: { icon: <Clock className="w-3.5 h-3.5" />,        bg: "bg-yellow-500/15 text-yellow-300" },
                  user:   { icon: <Users className="w-3.5 h-3.5" />,        bg: "bg-blue-500/15 text-blue-300" },
                  system: { icon: <Info className="w-3.5 h-3.5" />,         bg: "bg-fuchsia-500/15 text-fuchsia-300" },
                }[a.type];
                return (
                  <li key={i} className="px-5 py-3 flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${map.bg}`}>{map.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate">{a.text}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{a.sub}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{a.time}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Pendapatan + Pengumuman */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Revenue bar */}
        <div className="lg:col-span-2 rounded-2xl border border-border/60 bg-card/80 backdrop-blur p-5">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="font-bold text-sm">Pendapatan</p>
              <p className="text-2xl font-extrabold mt-0.5">{formatCurrency(totalRevenue)}</p>
              <p className="text-[10px] text-green-400 font-bold mt-0.5">▲ 8.7% dari kemarin</p>
            </div>
            <span className="text-[10px] text-muted-foreground bg-muted/40 border border-border rounded-full px-2 py-0.5 self-start">7 Hari Terakhir</span>
          </div>
          <div className="h-48 -mx-2 mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueTrend} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="bg1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a855f7" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="label" stroke="rgba(255,255,255,0.4)" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis stroke="rgba(255,255,255,0.4)" tick={{ fontSize: 9 }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => v >= 1_000_000 ? `${(v/1_000_000).toFixed(0)}M` : `${(v/1000).toFixed(0)}K`} />
                <Tooltip cursor={{ fill: "rgba(168,85,247,0.08)" }}
                  contentStyle={{ background: "rgba(20,20,30,0.9)", border: "1px solid rgba(168,85,247,0.4)", borderRadius: 12, fontSize: 12 }}
                  formatter={(v: number) => formatCurrency(v)}
                />
                <Bar dataKey="revenue" fill="url(#bg1)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Announcements / Broadcast */}
        <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur overflow-hidden">
          <div className="px-5 py-4 border-b border-border/60 flex items-center justify-between">
            <p className="font-bold text-sm flex items-center gap-2"><Megaphone className="w-4 h-4 text-primary" /> Pengumuman Terbaru</p>
            <button onClick={() => onGoTo("announcement")} className="text-xs text-primary font-bold flex items-center gap-1 hover:text-primary/80">
              Lihat <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="p-4 space-y-3">
            {activeBroadcast && (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-primary/10 border border-primary/30">
                <div className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center shrink-0">
                  <Radio className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">{activeBroadcast.title}</p>
                  <p className="text-[11px] text-muted-foreground line-clamp-2">{activeBroadcast.message}</p>
                </div>
              </div>
            )}
            {announcement ? (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border/60">
                <div className="w-8 h-8 rounded-lg bg-fuchsia-500/15 text-fuchsia-300 flex items-center justify-center shrink-0">
                  <Megaphone className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold">Pengumuman Aktif</p>
                  <p className="text-[11px] text-muted-foreground line-clamp-3">{announcement}</p>
                </div>
              </div>
            ) : null}
            <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border/60">
              <div className="w-8 h-8 rounded-lg bg-blue-500/15 text-blue-300 flex items-center justify-center shrink-0">
                <Bell className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold">{notifs.length} pembelian masuk hari ini</p>
                <p className="text-[11px] text-muted-foreground">Aktivitas live berjalan normal.</p>
              </div>
            </div>
            <button
              onClick={onDownload}
              className="w-full flex items-start gap-3 p-3 rounded-xl bg-gradient-to-br from-primary/15 to-purple-700/10 border border-primary/30 hover:from-primary/25 transition-all text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-primary/25 text-primary flex items-center justify-center shrink-0">
                <FileArchive className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold">Link Website Utama</p>
                <p className="text-[11px] text-muted-foreground">
                  {downloadInfo.updatedAt
                    ? `Live · build ${new Date(downloadInfo.updatedAt).toLocaleTimeString("id-ID")}`
                    : "Auto-update aktif — sinkron dengan deploy"}
                </p>
              </div>
              <Download className="w-4 h-4 text-primary shrink-0 mt-1" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Live Site URL helper ──────────────────────────────────────────────────
function getLiveSiteUrl(): string {
  if (typeof window === "undefined") return "";
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  return `${window.location.origin}${base}`;
}

// ─── Download / Live URL Panel ─────────────────────────────────────────────
function DownloadPanel({ info, onDownload, onOpenSite }: { info: { size?: number; updatedAt?: string }; onDownload: () => void; onOpenSite: () => void }) {
  const [liveUrl, setLiveUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    setLiveUrl(getLiveSiteUrl());
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(liveUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  const handleDownloadClick = () => {
    setDownloading(true);
    onDownload();
    setTimeout(() => setDownloading(false), 2500);
  };

  const fmtSize = (b?: number) => {
    if (!b) return "—";
    if (b > 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(2)} MB`;
    return `${(b / 1024).toFixed(1)} KB`;
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-purple-950/40 p-6 sm:p-8">
        <div className="absolute -right-12 -top-12 w-72 h-72 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
        <div className="relative flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/20 text-primary flex items-center justify-center shrink-0">
            <FileArchive className="w-7 h-7" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold tracking-widest text-primary">WEBSITE UTAMA · LIVE</p>
            <h2 className="text-2xl sm:text-3xl font-extrabold mt-1">Link Website Utama</h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-lg">
              Link di bawah otomatis menyesuaikan URL website yang sedang aktif.
              Setiap kali kamu deploy versi baru, semua pengguna yang sudah membuka
              halaman akan otomatis dimuat ulang ke versi terbaru.
            </p>
          </div>
        </div>

        <div className="mt-6 relative">
          <div className="flex items-stretch gap-2 bg-muted/40 border border-border/60 rounded-xl p-2">
            <div className="flex-1 min-w-0 px-3 py-2 font-mono text-xs sm:text-sm truncate" title={liveUrl}>
              {liveUrl || "—"}
            </div>
            <button
              onClick={handleCopy}
              className="px-3 py-2 rounded-lg bg-muted hover:bg-muted/70 text-xs font-bold inline-flex items-center gap-1.5 transition shrink-0"
            >
              {copied ? <CheckCircle className="w-3.5 h-3.5 text-green-400" /> : <FileArchive className="w-3.5 h-3.5" />}
              {copied ? "Tersalin" : "Salin"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
          <div className="bg-muted/30 border border-border/60 rounded-xl p-3">
            <p className="text-[10px] font-bold tracking-widest text-muted-foreground">UKURAN BUNDLE</p>
            <p className="text-sm font-extrabold mt-0.5 font-mono">{fmtSize(info.size)}</p>
          </div>
          <div className="bg-muted/30 border border-border/60 rounded-xl p-3">
            <p className="text-[10px] font-bold tracking-widest text-muted-foreground">BUILD TERAKHIR</p>
            <p className="text-sm font-extrabold mt-0.5">
              {info.updatedAt ? new Date(info.updatedAt).toLocaleString("id-ID") : "—"}
            </p>
          </div>
          <div className="bg-muted/30 border border-border/60 rounded-xl p-3 col-span-2 sm:col-span-1">
            <p className="text-[10px] font-bold tracking-widest text-muted-foreground">AUTO-UPDATE</p>
            <p className="text-sm font-extrabold mt-0.5 text-green-400">Aktif · poll 60 detik</p>
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleDownloadClick}
            disabled={downloading}
            className="flex-1 sm:flex-none px-6 py-3.5 rounded-xl bg-gradient-to-r from-primary to-purple-600 text-white font-bold text-sm hover:brightness-110 transition-all disabled:opacity-60 inline-flex items-center justify-center gap-2 shadow-lg shadow-primary/30"
          >
            {downloading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {downloading ? "Mengunduh..." : "Download Project (.tar.gz)"}
          </button>
          <button
            onClick={onOpenSite}
            className="flex-1 sm:flex-none px-6 py-3.5 rounded-xl bg-muted hover:bg-muted/70 text-foreground font-bold text-sm transition-all inline-flex items-center justify-center gap-2 border border-border/60"
          >
            <ExternalLink className="w-4 h-4" />
            Buka Website
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="rounded-2xl border border-border/60 bg-card/80 p-5">
        <p className="font-bold text-sm flex items-center gap-2 mb-3"><Info className="w-4 h-4 text-primary" /> Cara kerja auto-update</p>
        <ul className="space-y-2 text-sm">
          {[
            "Setiap build menulis file version.json dengan timestamp baru.",
            "Browser pengguna mengecek file itu setiap 60 detik (dan tiap kali tab di-fokus kembali).",
            "Kalau versinya berbeda, banner muncul dan halaman reload otomatis dalam 5 detik.",
            "Link di atas selalu menunjuk ke origin tempat website sedang dibuka — preview, .replit.app, atau custom domain.",
          ].map((t) => (
            <li key={t} className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// Helper: relative time
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  return `${d} hari lalu`;
}
