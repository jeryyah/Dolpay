// AdminChatNotifier — komponen ini di-mount sekali di App.tsx, aktif HANYA
// kalau user yang login adalah admin/owner. Tugasnya:
//   1. Selalu polling /api/chat (atau jsonblob fallback) tiap 1.5 detik,
//      tidak peduli admin lagi buka tab apa — chat tetap sync real-time.
//   2. Begitu ada pesan BARU dari "user" (bukan admin), tampilkan toast
//      floating + bunyikan beep singkat lewat Web Audio API.
//   3. Klik toast → navigasi ke /admin?tab=chat untuk balas cepat.
//
// Tanpa komponen ini, chat sync hanya jalan saat admin buka tab Chat —
// jadi notifikasi tidak akan masuk kalau admin lagi di tab Orders/Products.

import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { MessageSquare, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  startChatSync,
  getAllChatThreads,
  getChatThread,
  type ChatMessage,
} from "@/lib/extra-storage";
import { getUsers } from "@/lib/storage";

interface IncomingChat {
  userId: string;
  username?: string;
  text: string;
  at: string;
}

// Bunyikan beep notifikasi singkat. Pakai Web Audio API — tidak butuh
// file mp3 di-bundle, dan auto-mute kalau browser belum dapat user
// gesture (autoplay policy) sehingga tidak crash.
function playNotifBeep() {
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx: AudioContext = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
    osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.08); // E6
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
    setTimeout(() => ctx.close(), 600);
  } catch {}
}

export function AdminChatNotifier() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [incoming, setIncoming] = useState<IncomingChat | null>(null);
  // Snapshot id pesan terakhir per-user yang sudah pernah kita lihat,
  // supaya tidak double-notif saat polling berikutnya.
  const lastSeen = useRef<Record<string, string>>({});
  const initialized = useRef(false);

  const isAdmin = user?.role === "admin" || user?.role === "owner";

  useEffect(() => {
    if (!isAdmin) {
      lastSeen.current = {};
      initialized.current = false;
      return;
    }

    // Initialize lastSeen dari state sekarang — tidak notif untuk pesan
    // lama yang sudah ada sebelum admin login.
    if (!initialized.current) {
      const threads = getAllChatThreads();
      for (const t of threads) {
        const last = t.lastMessage;
        if (last) lastSeen.current[t.userId] = last.id;
      }
      initialized.current = true;
    }

    const stopSync = startChatSync(1500);

    const onChatEvent = () => {
      // Cek setiap thread: kalau pesan terakhir dari "user" beda dari yg
      // pernah kita lihat → notif baru.
      const threads = getAllChatThreads();
      for (const t of threads) {
        const last = t.lastMessage;
        if (!last) continue;
        const prevId = lastSeen.current[t.userId];
        if (prevId === last.id) continue;
        lastSeen.current[t.userId] = last.id;
        // Hanya notif kalau pesan dari user (admin tidak perlu notif untuk
        // balasannya sendiri) dan bukan pesan sistem [Sistem] reset.
        if (last.from !== "user") continue;
        if (last.text.startsWith("[Sistem]")) continue;
        const u = getUsers().find((x) => x.id === t.userId);
        playNotifBeep();
        setIncoming({
          userId: t.userId,
          username: u?.username,
          text: last.text,
          at: last.at,
        });
      }
    };

    window.addEventListener("pinz_chat_new", onChatEvent);
    return () => {
      stopSync();
      window.removeEventListener("pinz_chat_new", onChatEvent);
    };
  }, [isAdmin, user?.id]);

  // Auto-dismiss toast setelah 8 detik.
  useEffect(() => {
    if (!incoming) return;
    const t = setTimeout(() => setIncoming(null), 8000);
    return () => clearTimeout(t);
  }, [incoming]);

  if (!isAdmin || !incoming) return null;

  const goToChat = () => {
    setIncoming(null);
    // localStorage signal — admin.tsx baca di mount lalu auto-switch ke
    // tab Chat. Pakai signal-based daripada query string supaya tidak
    // tergantung router URL parsing.
    try {
      localStorage.setItem("pinz_admin_open_tab", "chat");
    } catch {}
    navigate("/admin");
  };

  return (
    <div
      className="fixed top-4 right-4 z-[100] max-w-sm w-[calc(100%-2rem)] sm:w-96 animate-in slide-in-from-top-2 fade-in duration-300"
      role="alert"
    >
      <div className="rounded-2xl border-2 border-primary/40 bg-card shadow-2xl shadow-primary/20 overflow-hidden">
        <div className="bg-gradient-to-r from-primary to-purple-600 px-4 py-2 flex items-center justify-between">
          <p className="text-xs font-black text-white flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" />
            Pesan baru dari pembeli
          </p>
          <button
            onClick={() => setIncoming(null)}
            className="text-white/80 hover:text-white"
            aria-label="Tutup"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <button
          onClick={goToChat}
          className="w-full text-left p-3 hover:bg-muted/30 transition"
        >
          <p className="text-sm font-bold mb-1">@{incoming.username || incoming.userId}</p>
          <p className="text-xs text-muted-foreground line-clamp-3 break-words">
            {incoming.text}
          </p>
          <p className="text-[10px] text-primary font-bold mt-2 uppercase tracking-wide">
            Klik untuk balas →
          </p>
        </button>
      </div>
    </div>
  );
}
