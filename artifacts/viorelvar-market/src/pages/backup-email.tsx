import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft, Mail, Send, CheckCircle2, AlertTriangle, Inbox, Pencil, ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  getUserOrders, backupKeyToEmail, updateUserProfile,
} from "@/lib/storage";

function timeAgo(iso?: string) {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  return `${d} hari lalu`;
}

export default function BackupEmail() {
  const { user, refresh } = useAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [editing, setEditing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [allBusy, setAllBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => { setEmail(user?.email || ""); setEditing(!user?.email); }, [user?.email]);

  if (!user) { navigate("/login"); return null; }

  const orders = useMemo(
    () => getUserOrders(user.id).filter((o) => (o.status === "verified" || o.status === "paid") && o.key),
    [user.id, tick],
  );

  const totalSent = orders.filter((o) => o.backupSentAt).length;

  const saveEmail = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMsg("err:Format email tidak valid.");
      return;
    }
    updateUserProfile(user.id, { email: email.trim() });
    refresh?.();
    setEditing(false);
    setMsg("ok:Email backup tersimpan.");
    setTimeout(() => setMsg(null), 2500);
  };

  const sendOne = (orderId: string) => {
    if (!user.email) { setMsg("err:Simpan email backup dulu di atas."); return; }
    setBusyId(orderId);
    const r = backupKeyToEmail(orderId, user.email);
    setBusyId(null);
    if (!r.ok) { setMsg("err:" + (r.error || "Gagal mengirim")); return; }
    setMsg("ok:Key dikirim ke " + user.email);
    setTick((x) => x + 1);
    setTimeout(() => setMsg(null), 2500);
  };

  const sendAll = async () => {
    if (!user.email) { setMsg("err:Simpan email backup dulu di atas."); return; }
    if (!confirm(`Kirim ${orders.length} key ke ${user.email}?`)) return;
    setAllBusy(true);
    for (const o of orders) backupKeyToEmail(o.id, user.email);
    setAllBusy(false);
    setMsg("ok:Semua key terkirim ke " + user.email);
    setTick((x) => x + 1);
    setTimeout(() => setMsg(null), 3000);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="container mx-auto px-4 h-14 flex items-center gap-3 max-w-3xl">
          <Link href="/">
            <button className="p-2 -ml-2 rounded-lg hover:bg-muted text-muted-foreground">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-sky-500/15 text-sky-300 flex items-center justify-center">
              <Mail className="w-4 h-4" />
            </div>
            <h1 className="font-bold text-base">Backup Key ke Email</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-5 max-w-3xl space-y-5">
        {/* Hero */}
        <section className="rounded-2xl border border-sky-500/30 bg-gradient-to-br from-sky-500/10 to-sky-500/0 p-5 relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-sky-500/20 blur-3xl pointer-events-none" />
          <div className="relative flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-300 flex items-center justify-center shrink-0">
              <Inbox className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="font-extrabold text-lg leading-tight">Simpan Key Tetap Aman</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Kirim ulang license key kamu ke email backup. Berguna kalau ganti HP, kehapus, atau lupa.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-background/50 border border-border/60 rounded-xl p-3">
              <p className="text-[10px] tracking-widest text-muted-foreground">TOTAL KEY</p>
              <p className="text-2xl font-extrabold text-sky-300 mt-0.5">{orders.length}</p>
            </div>
            <div className="bg-background/50 border border-border/60 rounded-xl p-3">
              <p className="text-[10px] tracking-widest text-muted-foreground">SUDAH DIKIRIM</p>
              <p className="text-2xl font-extrabold text-emerald-400 mt-0.5">{totalSent}</p>
            </div>
          </div>
        </section>

        {/* Email setup */}
        <section className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-bold text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" /> Alamat Email Backup
            </p>
            {!editing && user.email && (
              <button onClick={() => setEditing(true)} className="text-[11px] font-bold text-primary inline-flex items-center gap-1 hover:underline">
                <Pencil className="w-3 h-3" /> Ubah
              </button>
            )}
          </div>

          {editing ? (
            <div className="space-y-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="kamu@email.com"
                className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500/50"
              />
              <button
                onClick={saveEmail}
                className="w-full py-2.5 bg-primary text-primary-foreground font-bold text-sm rounded-xl hover:brightness-110 flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" /> Simpan Email
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between bg-background/50 border border-border rounded-xl px-3 py-2.5">
              <span className="text-sm font-mono">{user.email}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">VERIFIED</span>
            </div>
          )}
        </section>

        {msg && (
          <div className={`rounded-xl border px-4 py-3 text-sm flex items-start gap-2
            ${msg.startsWith("ok") ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                   : "border-destructive/30 bg-destructive/10 text-destructive"}`}>
            {msg.startsWith("ok") ? <CheckCircle2 className="w-4 h-4 mt-0.5" /> : <AlertTriangle className="w-4 h-4 mt-0.5" />}
            <span>{msg.slice(3)}</span>
          </div>
        )}

        {/* Bulk send */}
        {orders.length > 0 && user.email && (
          <button
            onClick={sendAll}
            disabled={allBusy}
            className="w-full py-3 bg-sky-500 text-black font-extrabold text-sm rounded-xl hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Send className={`w-4 h-4 ${allBusy ? "animate-pulse" : ""}`} />
            {allBusy ? "Mengirim..." : `Kirim Semua (${orders.length}) ke Email`}
          </button>
        )}

        {/* List */}
        <section className="space-y-3">
          <p className="text-xs font-bold tracking-widest text-muted-foreground">PILIH KEY UNTUK DIKIRIM</p>
          {orders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 p-10 text-center">
              <p className="text-sm font-bold">Belum ada key</p>
              <p className="text-[11px] text-muted-foreground mt-1">Beli produk dulu untuk dapat license key.</p>
            </div>
          ) : orders.map((o) => (
            <article key={o.id} className="rounded-2xl border border-border/60 bg-card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/15 text-sky-300 flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{o.productName}</p>
                <p className="text-[11px] text-muted-foreground truncate font-mono">
                  {o.key!.slice(0, 6)}••••••••{o.key!.slice(-4)}
                </p>
                {o.backupSentAt && (
                  <p className="text-[10px] text-emerald-400 mt-0.5 inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Terakhir dikirim {timeAgo(o.backupSentAt)}
                  </p>
                )}
              </div>
              <button
                onClick={() => sendOne(o.id)}
                disabled={busyId === o.id}
                className="shrink-0 px-3 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl hover:brightness-110 disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                <Send className={`w-3.5 h-3.5 ${busyId === o.id ? "animate-pulse" : ""}`} />
                {busyId === o.id ? "..." : "Kirim"}
              </button>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
