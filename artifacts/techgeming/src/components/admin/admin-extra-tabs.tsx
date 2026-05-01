import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Wrench, CalendarClock, Plus, Trash2, Database, FileDown, Upload,
  Activity, ShieldAlert, Gift, Tag as TagIcon, UserCog, Eye, KeyRound,
  Send, MessageSquare, Lock, RefreshCw, BarChart3, Package, AlertTriangle,
  CheckCircle, XCircle, Copy, Save, HardDrive, Eraser, Zap,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell,
} from "recharts";
import {
  type User, type Order, type UserRole, getUsers, getOrders, getStockKeys,
  getStorageUsage, clearSafeCaches, resetAllStorageExceptSession,
  type StorageUsage,
} from "@/lib/storage";
import { formatCurrency } from "@/lib/utils";
import { getAllProducts } from "@/lib/storage";
import {
  getMaintenance, setMaintenance,
  getScheduledAnnouncements, addScheduledAnnouncement, deleteScheduledAnnouncement,
  type ScheduledAnnouncement,
  getActivityLog, clearActivityLog, type ActivityEntry,
  banUser, unbanUser, setUserTags, giveBonus, getUserExt,
  bulkAddStockKeys,
  refundOrder,
  exportDatabase, downloadBackup, importDatabase,
  get2FASecret, getCurrent2FACode, reset2FASecret, set2FAEnabled,
  getAllChatThreads, getChatThread, sendChat, markChatRead, startChatSync, resetChatThread,
  startImpersonate, type ChatMessage,
  TIERS, type TierRole, getRoleBadge, setUserRole, autoGrantTier,
  getUserSpending, AUTO_GRANT_RULES,
} from "@/lib/extra-storage";
import { useAuth } from "@/lib/auth-context";
import { setSession, generateSessionToken, setSessionToken } from "@/lib/storage";
import { reseedDummyOrders } from "@/lib/seed-dummy";
import { useLocation } from "wouter";

// ════════════════════════════════════════════════════════════════════════
// 1. MAINTENANCE + SCHEDULED ANNOUNCEMENTS
// ════════════════════════════════════════════════════════════════════════
function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function StoragePanel() {
  const QUOTA_ESTIMATE = 5 * 1024 * 1024; // ~5 MB tipikal localStorage browser
  const [usage, setUsage] = useState<StorageUsage>(() => getStorageUsage());
  const [flash, setFlash] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [showFullReset, setShowFullReset] = useState(false);

  const refresh = () => setUsage(getStorageUsage());

  const flashMsg = (kind: "ok" | "err", text: string) => {
    setFlash({ kind, text });
    setTimeout(() => setFlash(null), 5000);
  };

  const handleClearSafe = () => {
    const r = clearSafeCaches();
    refresh();
    flashMsg("ok", `Berhasil membersihkan ${r.keysRemoved} cache (~${fmtBytes(r.bytesFreed)} dibebaskan).`);
  };

  const handleFullReset = () => {
    if (confirmText !== "RESET") {
      flashMsg("err", "Ketik RESET (huruf kapital semua) untuk konfirmasi.");
      return;
    }
    const r = resetAllStorageExceptSession();
    flashMsg("ok", `Berhasil hapus ${r.keysRemoved} item (~${fmtBytes(r.bytesFreed)}). Halaman akan dimuat ulang...`);
    setTimeout(() => window.location.reload(), 800);
  };

  const pct = Math.min(100, (usage.pinzBytes / QUOTA_ESTIMATE) * 100);
  const barColor = pct > 80 ? "bg-rose-500" : pct > 60 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex items-center gap-2">
        <HardDrive className="w-4 h-4 text-primary" />
        <p className="font-bold text-sm">Penyimpanan Browser</p>
        <button onClick={refresh} className="ml-auto text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1">
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      <div className="p-5 space-y-4">
        {/* Usage bar */}
        <div>
          <div className="flex items-end justify-between mb-1.5">
            <p className="text-xs text-muted-foreground">Pemakaian aplikasi</p>
            <p className="text-sm font-bold">
              {fmtBytes(usage.pinzBytes)} <span className="text-xs text-muted-foreground font-normal">/ ~{fmtBytes(QUOTA_ESTIMATE)} ({pct.toFixed(1)}%)</span>
            </p>
          </div>
          <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
            <div className={`h-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">
            {usage.pinzKeys} item aplikasi · {fmtBytes(usage.safeCacheBytes)} berupa cache yang aman dibersihkan
          </p>
        </div>

        {/* Top consumers */}
        {usage.topKeys.length > 0 && (
          <div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase mb-1.5">Item Terbesar</p>
            <div className="space-y-1">
              {usage.topKeys.map((k) => (
                <div key={k.key} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-muted/30">
                  <span className="font-mono truncate">{k.key}</span>
                  <span className="text-muted-foreground shrink-0 ml-2">{fmtBytes(k.bytes)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Flash message */}
        {flash && (
          <div className={`px-3 py-2 rounded-lg text-xs flex items-start gap-2 ${flash.kind === "ok" ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30" : "bg-rose-500/10 text-rose-300 border border-rose-500/30"}`}>
            {flash.kind === "ok" ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
            <span>{flash.text}</span>
          </div>
        )}

        {/* Action 1: Safe clear */}
        <div className="rounded-xl border border-border bg-background/40 p-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
              <Eraser className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold">Bersihkan Cache (Aman)</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Hapus log aktivitas, notifikasi pembelian, pesan chat, dan data dummy. Produk, pesanan, user, dan pengaturan TIDAK terhapus.
              </p>
              <button
                onClick={handleClearSafe}
                disabled={usage.safeCacheBytes === 0}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 text-black text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Zap className="w-3.5 h-3.5" />
                Bersihkan ({fmtBytes(usage.safeCacheBytes)})
              </button>
            </div>
          </div>
        </div>

        {/* Action 2: Full reset */}
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-rose-300">Reset Total Penyimpanan</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Hapus SEMUA data aplikasi di browser ini (produk custom, pesanan, user, kupon, pengaturan pembayaran, dll). Login admin tetap aktif. Tidak bisa dibatalkan.
              </p>
              {!showFullReset ? (
                <button
                  onClick={() => setShowFullReset(true)}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 text-xs font-bold"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Reset Total...
                </button>
              ) : (
                <div className="mt-3 space-y-2">
                  <p className="text-[11px] text-rose-300 font-semibold">Ketik RESET untuk konfirmasi:</p>
                  <input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="RESET"
                    className="w-full px-3 py-2 bg-background border border-rose-500/40 rounded-lg text-sm font-mono focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleFullReset}
                      disabled={confirmText !== "RESET"}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-rose-500 text-white text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Konfirmasi Reset Total
                    </button>
                    <button
                      onClick={() => { setShowFullReset(false); setConfirmText(""); }}
                      className="px-3 py-2 rounded-lg border border-border text-xs font-bold hover:bg-muted/40"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MaintenanceTab() {
  const [cfg, setCfg] = useState(() => getMaintenance());
  const [list, setList] = useState<ScheduledAnnouncement[]>(() => getScheduledAnnouncements());

  // form
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<ScheduledAnnouncement["type"]>("info");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const save = () => setCfg(setMaintenance(cfg));

  const addSched = () => {
    if (!title.trim() || !message.trim() || !start || !end) return alert("Lengkapi semua kolom");
    addScheduledAnnouncement({ title, message, type, startAt: new Date(start).toISOString(), endAt: new Date(end).toISOString() });
    setList(getScheduledAnnouncements());
    setTitle(""); setMessage(""); setStart(""); setEnd("");
  };
  const removeSched = (id: string) => {
    deleteScheduledAnnouncement(id);
    setList(getScheduledAnnouncements());
  };

  return (
    <div className="space-y-5">
      {/* Storage maintenance — paling atas supaya mudah ditemukan saat error "penyimpanan penuh" */}
      <StoragePanel />

      {/* Maintenance toggle */}
      <div className={`rounded-2xl border p-5 ${cfg.enabled ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-card"}`}>
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${cfg.enabled ? "bg-amber-500 text-black" : "bg-muted text-muted-foreground"}`}>
            <Wrench className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="font-extrabold text-lg">Mode Pemeliharaan</p>
                <p className="text-xs text-muted-foreground">User non-admin akan melihat layar maintenance.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={cfg.enabled} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })} className="sr-only peer" />
                <div className="w-12 h-6 bg-muted peer-checked:bg-amber-500 rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:w-5 after:h-5 after:transition-transform peer-checked:after:translate-x-6" />
              </label>
            </div>
            <textarea
              value={cfg.message}
              onChange={(e) => setCfg({ ...cfg, message: e.target.value })}
              rows={2}
              className="w-full mt-2 px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              placeholder="Pesan yang ditampilkan ke user..."
            />
            <input
              type="datetime-local"
              value={cfg.until ? cfg.until.slice(0, 16) : ""}
              onChange={(e) => setCfg({ ...cfg, until: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
              className="w-full mt-2 px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Estimasi selesai (opsional)</p>
            <button onClick={save} className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold">
              <Save className="w-3.5 h-3.5" /> Simpan
            </button>
          </div>
        </div>
      </div>

      {/* Scheduled */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-primary" />
          <p className="font-bold text-sm">Pengumuman Terjadwal</p>
          <span className="text-xs text-muted-foreground ml-auto">{list.length} terjadwal</span>
        </div>
        <div className="p-5 grid sm:grid-cols-2 gap-3 border-b border-border">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Judul" className="px-3 py-2 bg-background border border-border rounded-xl text-sm" />
          <select value={type} onChange={(e) => setType(e.target.value as any)} className="px-3 py-2 bg-background border border-border rounded-xl text-sm">
            <option value="info">Info</option>
            <option value="success">Success</option>
            <option value="warning">Warning</option>
            <option value="danger">Danger</option>
          </select>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} placeholder="Pesan..." className="sm:col-span-2 px-3 py-2 bg-background border border-border rounded-xl text-sm resize-none" />
          <div>
            <label className="text-[11px] font-bold text-muted-foreground uppercase">Mulai</label>
            <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm mt-1" />
          </div>
          <div>
            <label className="text-[11px] font-bold text-muted-foreground uppercase">Berakhir</label>
            <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm mt-1" />
          </div>
          <button onClick={addSched} className="sm:col-span-2 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold">
            <Plus className="w-4 h-4" /> Jadwalkan
          </button>
        </div>
        <div className="divide-y divide-border/40 max-h-72 overflow-y-auto">
          {list.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">Belum ada pengumuman terjadwal</div>
          ) : list.map((s) => (
            <div key={s.id} className="px-5 py-3 flex items-start gap-3">
              <span className={`shrink-0 px-2 py-0.5 rounded-md text-[9px] font-black uppercase
                ${s.type === "warning" ? "bg-amber-500/20 text-amber-300" :
                  s.type === "success" ? "bg-emerald-500/20 text-emerald-300" :
                  s.type === "danger" ? "bg-rose-500/20 text-rose-300" : "bg-sky-500/20 text-sky-300"}`}>{s.type}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{s.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">{s.message}</p>
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                  {new Date(s.startAt).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })} → {new Date(s.endAt).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}
                </p>
              </div>
              <button onClick={() => removeSched(s.id)} className="shrink-0 p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-lg">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// 2. BACKUP / EXPORT DATABASE
// ════════════════════════════════════════════════════════════════════════
export function BackupTab() {
  const [snap, setSnap] = useState(() => exportDatabase());
  const [importMsg, setImportMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [reseedMsg, setReseedMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleReseed = () => {
    if (!confirm("Reset semua data contoh (dummy orders) dan buat ulang dari produk yang ada saat ini?")) return;
    const n = reseedDummyOrders();
    setReseedMsg(`Berhasil membuat ${n} order contoh dari produk Anda saat ini.`);
    setSnap(exportDatabase());
    setTimeout(() => setReseedMsg(null), 4000);
  };

  const handleImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        const r = importDatabase(data);
        if (r.ok) {
          setImportMsg({ kind: "ok", text: `Berhasil pulihkan ${r.restored} key. Reload halaman untuk melihat efeknya.` });
          setSnap(exportDatabase());
        } else {
          setImportMsg({ kind: "err", text: r.error || "Gagal" });
        }
      } catch {
        setImportMsg({ kind: "err", text: "File JSON tidak valid." });
      }
    };
    reader.readAsText(file);
  };

  const sizeKB = (JSON.stringify(snap).length / 1024).toFixed(1);
  const tableCount = Object.keys(snap.data).length;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-500 flex items-center justify-center text-white">
            <Database className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="font-extrabold text-lg mb-1">Backup Database</p>
            <p className="text-xs text-muted-foreground mb-4">Export seluruh data lokal (user, order, stok, settings) ke file JSON.</p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              <Stat label="Tabel" value={tableCount.toString()} />
              <Stat label="Ukuran" value={`${sizeKB} KB`} />
              <Stat label="Versi" value={snap.version} />
            </div>
            <div className="flex gap-2">
              <button onClick={downloadBackup} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold">
                <FileDown className="w-3.5 h-3.5" /> Unduh Backup (.json)
              </button>
              <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-xs font-bold hover:bg-muted">
                <Upload className="w-3.5 h-3.5" /> Pulihkan dari File
              </button>
              <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])} />
            </div>
            {importMsg && (
              <p className={`text-xs mt-2 ${importMsg.kind === "ok" ? "text-emerald-400" : "text-rose-400"}`}>{importMsg.text}</p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center text-white">
            <RefreshCw className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="font-extrabold text-lg mb-1">Reset Data Contoh</p>
            <p className="text-xs text-muted-foreground mb-4">
              Hapus order dummy lama dan buat ulang berdasarkan produk yang Anda kelola saat ini.
              Order asli dari user real tidak akan disentuh.
            </p>
            <button onClick={handleReseed} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold">
              <RefreshCw className="w-3.5 h-3.5" /> Reset & Generate Ulang
            </button>
            {reseedMsg && <p className="text-xs mt-2 text-emerald-400">{reseedMsg}</p>}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <p className="font-bold text-sm">Isi Backup (preview)</p>
        </div>
        <div className="p-4 max-h-64 overflow-auto">
          <pre className="text-[10px] text-muted-foreground font-mono">{JSON.stringify(Object.keys(snap.data).map((k) => ({ key: k, items: Array.isArray(snap.data[k]) ? snap.data[k].length : 1 })), null, 2)}</pre>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/30 border border-border/40 px-3 py-2">
      <p className="text-[10px] uppercase text-muted-foreground tracking-widest">{label}</p>
      <p className="font-extrabold text-sm">{value}</p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// 3. BULK STOCK UPLOAD
// ════════════════════════════════════════════════════════════════════════
export function BulkStockTab() {
  const allProducts = getAllProducts();
  const [productId, setProductId] = useState(allProducts[0]?.id || "");
  const product = allProducts.find((p) => p.id === productId);
  const [variantId, setVariantId] = useState(product?.variants[0]?.id || "");
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ added: number; total: number; sample: string[] } | null>(null);

  useEffect(() => {
    setVariantId(product?.variants[0]?.id || "");
  }, [productId]);

  const handleAdd = () => {
    if (!product || !variantId) return;
    const r = bulkAddStockKeys(productId, variantId, text);
    setResult(r);
    setText("");
  };

  const currentStock = product && variantId ? getStockKeys(productId, variantId).length : 0;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="font-extrabold text-lg mb-1 flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-primary" /> Bulk Upload Stok Key
        </p>
        <p className="text-xs text-muted-foreground mb-4">Tempel banyak key sekaligus, satu per baris (atau pisah dengan koma/titik koma).</p>

        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-[11px] font-bold text-muted-foreground uppercase mb-1 block">Produk</label>
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm">
              {allProducts.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-bold text-muted-foreground uppercase mb-1 block">Varian</label>
            <select value={variantId} onChange={(e) => setVariantId(e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm">
              {product?.variants.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[11px] font-bold text-muted-foreground uppercase">Daftar Key Baru</label>
          <span className="text-[10px] text-muted-foreground">Stok saat ini: <b className="text-foreground">{currentStock}</b></span>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder={`KEY-001\nKEY-002\nKEY-003\n...`}
          className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button onClick={handleAdd} disabled={!text.trim()} className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50">
          <Plus className="w-3.5 h-3.5" /> Tambahkan ke Stok
        </button>

        {result && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs">
            <p className="font-bold text-emerald-300 mb-1">✓ {result.added} key berhasil ditambahkan</p>
            <p className="text-muted-foreground">Total stok sekarang: {result.total}</p>
            {result.sample.length > 0 && (
              <p className="text-[10px] font-mono text-muted-foreground mt-1.5">Contoh: {result.sample.join(", ")}</p>
            )}
          </div>
        )}
      </div>

      {/* Stok overview semua produk */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <p className="font-bold text-sm flex items-center gap-2"><Package className="w-4 h-4" /> Stok per Produk</p>
        </div>
        <div className="divide-y divide-border/40 max-h-80 overflow-y-auto">
          {allProducts.map((p) => (
            <div key={p.id} className="px-5 py-3">
              <p className="text-sm font-bold mb-1.5">{p.title}</p>
              <div className="flex flex-wrap gap-1.5">
                {p.variants.map((v) => {
                  const n = getStockKeys(p.id, v.id).length;
                  return (
                    <span key={v.id} className={`text-[10px] px-2 py-0.5 rounded-md font-bold border
                      ${n === 0 ? "border-rose-500/40 bg-rose-500/10 text-rose-300" :
                        n < 5 ? "border-amber-500/40 bg-amber-500/10 text-amber-300" :
                        "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"}`}>
                      {v.label}: {n}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// 4. SALES CHARTS
// ════════════════════════════════════════════════════════════════════════
export function ChartsTab({ orders }: { orders: Order[] }) {
  const data = useMemo(() => {
    const days = 14;
    const out: { day: string; omzet: number; orders: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000);
      const ds = d.toISOString().slice(0, 10);
      const todayOrders = orders.filter((o) =>
        (o.status === "verified" || o.status === "paid") && o.createdAt.startsWith(ds),
      );
      out.push({
        day: d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
        omzet: todayOrders.reduce((s, o) => s + (o.finalPriceIDR ?? o.variantPrice), 0),
        orders: todayOrders.length,
      });
    }
    return out;
  }, [orders]);

  const totalOmzet = data.reduce((s, x) => s + x.omzet, 0);
  const totalOrders = data.reduce((s, x) => s + x.orders, 0);
  const avgOrder = totalOrders > 0 ? totalOmzet / totalOrders : 0;

  // Pie: payment method distribution
  const qris = orders.filter((o) => o.paymentMethod === "qris").length;
  const usdt = orders.filter((o) => o.paymentMethod === "usdt").length;
  const pieData = [
    { name: "QRIS", value: qris, color: "#aaff00" },
    { name: "Binance/USDT", value: usdt, color: "#a855f7" },
  ];

  // Top products
  const productMap = new Map<string, { name: string; orders: number; revenue: number }>();
  orders.filter((o) => o.status === "verified" || o.status === "paid").forEach((o) => {
    const cur = productMap.get(o.productId) || { name: o.productName, orders: 0, revenue: 0 };
    cur.orders += 1;
    cur.revenue += o.finalPriceIDR ?? o.variantPrice;
    productMap.set(o.productId, cur);
  });
  const topProducts = Array.from(productMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 6);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Omzet 14 Hari" value={formatCurrency(totalOmzet)} />
        <Stat label="Transaksi" value={totalOrders.toLocaleString("id-ID")} />
        <Stat label="Rata-rata" value={formatCurrency(Math.round(avgOrder))} />
      </div>

      {/* Omzet area */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="font-bold text-sm mb-3 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" /> Grafik Omzet 14 Hari</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="omzetG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#aaff00" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#aaff00" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="day" stroke="#888" fontSize={10} />
              <YAxis stroke="#888" fontSize={10} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: "#0c0c10", border: "1px solid #ffffff20", borderRadius: 12 }} formatter={(v: any) => formatCurrency(v as number)} />
              <Area type="monotone" dataKey="omzet" stroke="#aaff00" strokeWidth={2} fill="url(#omzetG)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Orders bar */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="font-bold text-sm mb-3">Jumlah Order Harian</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="day" stroke="#888" fontSize={10} />
                <YAxis stroke="#888" fontSize={10} />
                <Tooltip contentStyle={{ background: "#0c0c10", border: "1px solid #ffffff20", borderRadius: 12 }} />
                <Bar dataKey="orders" fill="#a855f7" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie payment */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="font-bold text-sm mb-3">Metode Pembayaran</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={4}>
                  {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#0c0c10", border: "1px solid #ffffff20", borderRadius: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-2 text-xs">
            {pieData.map((d) => (
              <div key={d.name} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                <span className="text-muted-foreground">{d.name}: <b className="text-foreground">{d.value}</b></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top products */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <p className="font-bold text-sm">🏆 Top Produk</p>
        </div>
        {topProducts.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">Belum ada penjualan</div>
        ) : (
          <div className="divide-y divide-border/40">
            {topProducts.map((p, i) => (
              <div key={p.name} className="px-5 py-3 flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-primary/10 text-primary font-black text-sm flex items-center justify-center">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground">{p.orders} order</p>
                </div>
                <p className="text-sm font-extrabold text-emerald-400">{formatCurrency(p.revenue)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// 5. USER MANAGEMENT (ban / tag / bonus / impersonate)
// ════════════════════════════════════════════════════════════════════════
export function UserMgmtTab({ users, refresh }: { users: User[]; refresh: () => void }) {
  const { user: actor } = useAuth();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<User | null>(null);

  const filtered = users.filter((u) =>
    !search.trim() || u.username.toLowerCase().includes(search.toLowerCase()),
  ).slice(0, 200);

  const impersonate = (target: User) => {
    if (!actor) return;
    if (!confirm(`Impersonate sebagai ${target.username}?`)) return;
    startImpersonate(actor);
    setSession(target);
    setSessionToken(generateSessionToken());
    navigate("/");
    setTimeout(() => window.location.reload(), 100);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari username..."
          className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <p className="font-bold text-sm flex items-center gap-2"><UserCog className="w-4 h-4" /> Manajemen User</p>
          <span className="text-xs text-muted-foreground">{filtered.length} dari {users.length}</span>
        </div>
        <div className="divide-y divide-border/40 max-h-[560px] overflow-y-auto">
          {filtered.map((u) => {
            const ext = getUserExt(u.id);
            const banned = (ext as any)?.banned;
            const tags = (ext as any)?.tags as string[] | undefined;
            const balance = (ext as any)?.balance || 0;
            return (
              <div key={u.id} className={`px-5 py-3 ${banned ? "bg-rose-500/5" : ""}`}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {u.username[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold truncate">@{u.username}</p>
                      {(() => { const b = getRoleBadge(u.role); return (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase ${b.className}`}>{b.label}</span>
                      ); })()}
                      {banned && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-300 font-bold">BANNED</span>}
                      {tags?.map((t) => <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-md bg-primary/15 text-primary font-bold">{t}</span>)}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Saldo bonus: <b className="text-emerald-400">{formatCurrency(balance)}</b>
                      {(ext as any)?.streak?.current ? ` · Streak ${(ext as any).streak.current}🔥` : ""}
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => setEditing(u)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg" title="Edit">
                      <UserCog className="w-3.5 h-3.5" />
                    </button>
                    {u.role === "user" && (
                      <button onClick={() => impersonate(u)} className="p-1.5 text-sky-400 hover:bg-sky-500/10 rounded-lg" title="Impersonate">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {u.role !== "owner" && (
                      banned ? (
                        <button onClick={() => { unbanUser(u.id, actor?.username); refresh(); }} className="p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded-lg" title="Unban">
                          <CheckCircle className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button onClick={() => {
                          const r = prompt(`Alasan ban ${u.username}:`);
                          if (r?.trim()) { banUser(u.id, r.trim(), actor?.username); refresh(); }
                        }} className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-lg" title="Ban">
                          <ShieldAlert className="w-3.5 h-3.5" />
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="p-8 text-center text-xs text-muted-foreground">Tidak ada user</div>
          )}
        </div>
      </div>

      {editing && <UserEditModal user={editing} onClose={() => { setEditing(null); refresh(); }} actor={actor?.username} />}
    </div>
  );
}

function UserEditModal({ user, onClose, actor }: { user: User; onClose: () => void; actor?: string }) {
  const ext = getUserExt(user.id);
  const [tags, setTags] = useState<string>(((ext as any)?.tags || []).join(", "));
  const [bonusAmt, setBonusAmt] = useState("");
  const [bonusReason, setBonusReason] = useState("");

  const saveTags = () => {
    const arr = tags.split(",").map((t) => t.trim()).filter(Boolean);
    setUserTags(user.id, arr);
  };
  const giveB = () => {
    const n = parseInt(bonusAmt, 10);
    if (!n || n <= 0) return;
    giveBonus(user.id, n, bonusReason.trim() || "Bonus manual", actor);
    setBonusAmt(""); setBonusReason("");
    alert("Bonus diberikan");
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl max-w-md w-full p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="font-extrabold">Edit @{user.username}</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>

        <div>
          <label className="text-[11px] font-bold text-muted-foreground uppercase mb-1 block">Tags (pisah koma)</label>
          <div className="flex gap-2">
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="VIP, Suspicious, Reseller" className="flex-1 px-3 py-2 bg-background border border-border rounded-xl text-sm" />
            <button onClick={() => { saveTags(); alert("Tags disimpan"); }} className="px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold">Simpan</button>
          </div>
        </div>

        <div>
          <label className="text-[11px] font-bold text-muted-foreground uppercase mb-1 block">Beri Bonus Manual (IDR)</label>
          <div className="space-y-2">
            <input type="number" value={bonusAmt} onChange={(e) => setBonusAmt(e.target.value)} placeholder="50000" className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm" />
            <input value={bonusReason} onChange={(e) => setBonusReason(e.target.value)} placeholder="Alasan (mis: kompensasi)" className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm" />
            <button onClick={giveB} className="w-full px-3 py-2 rounded-xl bg-emerald-500 text-black text-xs font-bold flex items-center justify-center gap-1.5">
              <Gift className="w-3.5 h-3.5" /> Kirim Bonus
            </button>
          </div>
        </div>

        {(ext as any)?.bonusLog?.length > 0 && (
          <div className="border-t border-border pt-3">
            <p className="text-[11px] font-bold text-muted-foreground uppercase mb-2">Riwayat Bonus</p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {((ext as any).bonusLog as any[]).slice(-10).reverse().map((b) => (
                <div key={b.id} className="text-xs flex justify-between border-b border-border/30 pb-1">
                  <span className="text-muted-foreground truncate">{b.reason}</span>
                  <span className="text-emerald-400 font-bold">+{formatCurrency(b.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// 6. ACTIVITY LOG
// ════════════════════════════════════════════════════════════════════════
export function ActivityLogTab() {
  const [list, setList] = useState<ActivityEntry[]>(() => getActivityLog());
  const [filter, setFilter] = useState<"all" | ActivityEntry["category"]>("all");
  useEffect(() => {
    const t = setInterval(() => setList(getActivityLog()), 5000);
    return () => clearInterval(t);
  }, []);
  const filtered = filter === "all" ? list : list.filter((x) => x.category === filter);

  const COLORS: Record<ActivityEntry["category"], string> = {
    auth: "text-sky-300 bg-sky-500/10 border-sky-500/30",
    order: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
    user: "text-purple-300 bg-purple-500/10 border-purple-500/30",
    admin: "text-amber-300 bg-amber-500/10 border-amber-500/30",
    payment: "text-pink-300 bg-pink-500/10 border-pink-500/30",
    system: "text-muted-foreground bg-muted/40 border-border",
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-card p-3 flex items-center gap-2 flex-wrap">
        {(["all", "auth", "order", "user", "admin", "payment", "system"] as const).map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition ${filter === c ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted"}`}
          >
            {c.toUpperCase()}
          </button>
        ))}
        <button onClick={() => { if (confirm("Hapus semua log?")) { clearActivityLog(); setList([]); } }} className="ml-auto text-xs text-rose-400 font-bold px-3 py-1.5 rounded-lg hover:bg-rose-500/10">
          Hapus log
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <p className="font-bold text-sm flex items-center gap-2"><Activity className="w-4 h-4" /> Activity Log</p>
          <span className="text-xs text-muted-foreground">{filtered.length} entri</span>
        </div>
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">Belum ada aktivitas</div>
        ) : (
          <div className="divide-y divide-border/40 max-h-[560px] overflow-y-auto">
            {filtered.map((e) => (
              <div key={e.id} className="px-5 py-2.5 flex items-start gap-3">
                <span className={`shrink-0 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase border ${COLORS[e.category]}`}>{e.category}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs">{e.message}</p>
                  <p className="text-[10px] text-muted-foreground/70">
                    {new Date(e.at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "medium" })}
                    {e.actor ? ` · @${e.actor}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// 7. 2FA OWNER
// ════════════════════════════════════════════════════════════════════════
export function TwoFATab() {
  const { user, refresh } = useAuth();
  const [secret, setSecret] = useState(() => get2FASecret());
  const [code, setCode] = useState(() => getCurrent2FACode());
  const ext = user ? getUserExt(user.id) : null;
  const enabled = !!(ext as any)?.twoFA;

  useEffect(() => {
    const t = setInterval(() => setCode(getCurrent2FACode()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!user) return null;

  return (
    <div className="space-y-5 max-w-xl">
      <div className={`rounded-2xl border p-5 ${enabled ? "border-emerald-500/40 bg-emerald-500/5" : "border-border bg-card"}`}>
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${enabled ? "bg-emerald-500 text-black" : "bg-muted text-muted-foreground"}`}>
            <Lock className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="font-extrabold text-lg">2FA Owner</p>
            <p className="text-xs text-muted-foreground mb-3">Aktifkan kode 6-digit yang berubah tiap 30 detik untuk login owner.</p>
            <button
              onClick={() => { set2FAEnabled(user.id, !enabled); refresh(); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold ${enabled ? "bg-rose-500 text-white" : "bg-emerald-500 text-black"}`}
            >
              {enabled ? "Nonaktifkan 2FA" : "Aktifkan 2FA"}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Kode Saat Ini (refresh tiap 30 detik)</p>
        <div className="flex items-center gap-3">
          <div className="flex-1 px-4 py-3 rounded-xl bg-background border border-primary/40 font-mono text-3xl font-black tracking-[0.4em] text-center text-primary">
            {code}
          </div>
          <button onClick={() => { navigator.clipboard?.writeText(code); }} className="p-3 rounded-xl border border-border hover:bg-muted">
            <Copy className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-4 mb-2">Secret Key</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 px-3 py-2 rounded-xl bg-muted/30 text-xs font-mono break-all">{secret}</code>
          <button onClick={() => { if (confirm("Reset secret? Kode lama tidak akan valid lagi.")) setSecret(reset2FASecret()); }} className="px-3 py-2 rounded-xl border border-border hover:bg-muted text-xs font-bold flex items-center gap-1">
            <RefreshCw className="w-3.5 h-3.5" /> Reset
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// 8. REFUND DRAWER (used inline in OrderCard via prop)
// ════════════════════════════════════════════════════════════════════════
export function RefundModal({ order, onClose, onDone, actor }: { order: Order; onClose: () => void; onDone: () => void; actor?: string }) {
  const [reason, setReason] = useState("");
  const submit = () => {
    if (!reason.trim()) return alert("Alasan wajib diisi");
    refundOrder(order.id, reason.trim(), actor);
    onDone();
    onClose();
  };
  return (
    <div className="fixed inset-0 z-[400] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-rose-500/40 rounded-2xl max-w-sm w-full p-5" onClick={(e) => e.stopPropagation()}>
        <p className="font-extrabold text-lg flex items-center gap-2 mb-2">
          <AlertTriangle className="w-5 h-5 text-rose-400" /> Refund Order
        </p>
        <p className="text-xs text-muted-foreground mb-3">Order <code className="font-mono text-foreground">{order.id}</code> akan dibatalkan.</p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Alasan refund / pembatalan..."
          className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-rose-500 resize-none"
        />
        <div className="flex gap-2 mt-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-xl border border-border text-xs font-bold hover:bg-muted">Batal</button>
          <button onClick={submit} className="flex-1 px-4 py-2 rounded-xl bg-rose-500 text-white text-xs font-bold">Refund</button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// 9. LIVE CHAT (Admin side)
// ════════════════════════════════════════════════════════════════════════
export function ChatTab() {
  const { user: actor } = useAuth();
  const [threads, setThreads] = useState(() => getAllChatThreads());
  const [activeUser, setActiveUser] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  const refresh = () => {
    setThreads(getAllChatThreads());
    if (activeUser) setMsgs(getChatThread(activeUser));
  };

  useEffect(() => {
    refresh();
    // Polling sinkron ke server (Netlify Blobs) — pesan dari pembeli di
    // perangkat lain langsung muncul di inbox admin tanpa reload.
    const stopSync = startChatSync(1500);
    const onChatEvent = () => refresh();
    window.addEventListener("pinz_chat_new", onChatEvent);
    return () => {
      stopSync();
      window.removeEventListener("pinz_chat_new", onChatEvent);
    };
  }, [activeUser]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);

  const open = (uid: string) => {
    setActiveUser(uid);
    markChatRead(uid, "user");
    setMsgs(getChatThread(uid));
  };

  const send = () => {
    if (!activeUser || !draft.trim()) return;
    sendChat(activeUser, "admin", draft.trim());
    setDraft("");
    refresh();
  };

  const onReset = () => {
    if (!activeUser) return;
    const u = userMap.get(activeUser);
    if (!confirm(`Reset seluruh riwayat chat dengan @${u?.username || activeUser}?\n\nSemua pesan akan dihapus permanen di server dan di semua perangkat.`)) return;
    resetChatThread(activeUser, "admin", actor?.username);
    refresh();
  };

  const userMap = new Map(getUsers().map((u) => [u.id, u]));

  return (
    <div className="grid lg:grid-cols-[260px_1fr] gap-4 h-[600px]">
      <div className="rounded-2xl border border-border bg-card overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <p className="font-bold text-sm flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Chat</p>
          <span className="text-xs text-muted-foreground">{threads.length}</span>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-border/40">
          {threads.length === 0 ? (
            <div className="p-6 text-xs text-muted-foreground text-center">Belum ada chat masuk</div>
          ) : threads.map((t) => {
            const u = userMap.get(t.userId);
            return (
              <button key={t.userId} onClick={() => open(t.userId)} className={`w-full text-left p-3 transition ${activeUser === t.userId ? "bg-primary/10" : "hover:bg-muted/30"}`}>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {(u?.username || "?")[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate">@{u?.username || t.userId}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{t.lastMessage?.text || "—"}</p>
                  </div>
                  {t.unread > 0 && <span className="text-[9px] font-black bg-rose-500 text-white px-1.5 rounded-full">{t.unread}</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card flex flex-col overflow-hidden">
        {!activeUser ? (
          <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">Pilih pengguna di kiri untuk memulai</div>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
              <p className="font-bold text-sm truncate">@{userMap.get(activeUser)?.username || activeUser}</p>
              <button
                onClick={onReset}
                title="Reset / hapus seluruh riwayat chat dengan user ini"
                className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 transition"
              >
                <Trash2 className="w-3.5 h-3.5" /> Reset Pesan
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {msgs.map((m) => (
                <div key={m.id} className={`flex ${m.from === "admin" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-xs
                    ${m.from === "admin" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"}`}>
                    {m.text}
                    <p className="text-[9px] opacity-60 mt-0.5 text-right">
                      {new Date(m.at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
            <div className="border-t border-border p-2 flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") send(); }}
                placeholder="Balas..."
                className="flex-1 px-3 py-2 rounded-xl bg-background border border-border text-sm focus:outline-none"
              />
              <button onClick={send} disabled={!draft.trim()} className="px-3 rounded-xl bg-primary text-primary-foreground disabled:opacity-50">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// 11. ROLES & TIERS — Reseller / Pro / Elite
// ════════════════════════════════════════════════════════════════════════
export function RoleTierTab({ users, refresh }: { users: User[]; refresh: () => void }) {
  const { user: actor } = useAuth();
  const [search, setSearch] = useState("");
  const [autoMsg, setAutoMsg] = useState<string | null>(null);

  const ROLE_OPTIONS: UserRole[] = ["user", "reseller", "pro", "elite", "admin"];

  const filtered = users
    .filter((u) => u.role !== "owner") // owner cannot be reassigned
    .filter((u) => !search.trim() || u.username.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 300);

  const tierCounts = useMemo(() => {
    const c: Record<string, number> = { user: 0, reseller: 0, pro: 0, elite: 0, admin: 0, owner: 0 };
    for (const u of users) c[u.role] = (c[u.role] || 0) + 1;
    return c;
  }, [users]);

  const onChangeRole = (u: User, nextRole: UserRole) => {
    if (nextRole === u.role) return;
    if (!confirm(`Ubah role @${u.username} dari ${u.role.toUpperCase()} ke ${nextRole.toUpperCase()}?`)) return;
    setUserRole(u.id, nextRole, actor?.username);
    refresh();
  };

  const runAutoGrant = (target: TierRole) => {
    const upgraded = autoGrantTier(target, actor?.username);
    setAutoMsg(
      upgraded.length === 0
        ? `Tidak ada user yang memenuhi syarat ${TIERS[target].label} saat ini.`
        : `${upgraded.length} user berhasil dinaikkan ke ${TIERS[target].label}: ${upgraded.map((u) => "@" + u.username).join(", ")}`,
    );
    refresh();
  };

  return (
    <div className="space-y-5">
      {/* Tier overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {(["reseller", "pro", "elite"] as TierRole[]).map((k) => {
          const t = TIERS[k];
          const rule = AUTO_GRANT_RULES[k];
          return (
            <div key={k} className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase ${t.badgeClass}`}>{t.label}</span>
                <span className="text-[10px] text-muted-foreground font-bold">{tierCounts[k] || 0} user</span>
              </div>
              <p className="text-2xl font-black text-emerald-400 leading-none">−{t.discountPct}%</p>
              <ul className="text-[11px] text-muted-foreground space-y-1">
                {t.perks.map((p) => <li key={p} className="flex gap-1.5"><CheckCircle className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" /><span>{p}</span></li>)}
              </ul>
              <div className="border-t border-border pt-2 text-[10px] text-muted-foreground">
                Auto-grant jika ≥ <b className="text-foreground">{rule.minOrders}</b> order verified
                ATAU total spend ≥ <b className="text-foreground">{formatCurrency(rule.minSpendIDR)}</b>
              </div>
              <button
                onClick={() => runAutoGrant(k)}
                className={`w-full px-3 py-2 rounded-xl text-xs font-bold ${t.badgeClass}`}
              >
                Auto-Grant {t.label}
              </button>
            </div>
          );
        })}
      </div>

      {autoMsg && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-300 flex items-start gap-2">
          <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span className="flex-1">{autoMsg}</span>
          <button onClick={() => setAutoMsg(null)} className="text-emerald-200/60 hover:text-emerald-100">✕</button>
        </div>
      )}

      {/* Search */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari username..."
          className="w-full px-3 py-2 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* User list with role select */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <p className="font-bold text-sm flex items-center gap-2"><UserCog className="w-4 h-4" /> Atur Role / Tier</p>
          <span className="text-xs text-muted-foreground">{filtered.length} user</span>
        </div>
        <div className="divide-y divide-border/40 max-h-[560px] overflow-y-auto">
          {filtered.map((u) => {
            const badge = getRoleBadge(u.role);
            const stats = getUserSpending(u.id);
            return (
              <div key={u.id} className="px-5 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {u.username[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold truncate">@{u.username}</p>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase ${badge.className}`}>{badge.label}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground tabular-nums">
                    {stats.verifiedCount} order verified · total {formatCurrency(stats.verifiedTotalIDR)}
                  </p>
                </div>
                <select
                  value={u.role}
                  onChange={(e) => onChangeRole(u, e.target.value as UserRole)}
                  className="px-2 py-1.5 rounded-lg bg-background border border-border text-xs font-bold uppercase focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r.toUpperCase()}</option>)}
                </select>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="p-8 text-center text-xs text-muted-foreground">Tidak ada user</div>
          )}
        </div>
      </div>
    </div>
  );
}
