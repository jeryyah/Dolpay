import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { MessageCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getChatThread } from "@/lib/extra-storage";

const POS_KEY = "pinz_chat_fab_pos";
const FAB_SIZE = 56;
const PADDING = 12;

interface Pos { x: number; y: number; }

function clampPos(p: Pos): Pos {
  const w = window.innerWidth;
  const h = window.innerHeight;
  return {
    x: Math.max(PADDING, Math.min(w - FAB_SIZE - PADDING, p.x)),
    y: Math.max(PADDING, Math.min(h - FAB_SIZE - PADDING, p.y)),
  };
}

function defaultPos(): Pos {
  return clampPos({ x: window.innerWidth - FAB_SIZE - 20, y: window.innerHeight - FAB_SIZE - 90 });
}

function loadPos(): Pos {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Pos;
      if (typeof parsed.x === "number" && typeof parsed.y === "number") return clampPos(parsed);
    }
  } catch {}
  return defaultPos();
}

export function ChatFab() {
  const { user, isAdmin, isOwner } = useAuth();
  const [location, navigate] = useLocation();
  const [pos, setPos] = useState<Pos>(() => (typeof window !== "undefined" ? defaultPos() : { x: 0, y: 0 }));
  const [dragging, setDragging] = useState(false);
  const [unread, setUnread] = useState(0);
  const movedRef = useRef(false);
  const startRef = useRef<{ pointerX: number; pointerY: number; baseX: number; baseY: number; pid: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Initial position from storage (after mount, window is available).
  useEffect(() => {
    setPos(loadPos());
  }, []);

  // Keep within viewport on resize.
  useEffect(() => {
    const onResize = () => setPos((p) => clampPos(p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Unread count for the current user.
  useEffect(() => {
    if (!user) { setUnread(0); return; }
    const calc = () => {
      const thread = getChatThread(user.id);
      const n = thread.filter((m) => m.from === "admin" && !m.read).length;
      setUnread(n);
    };
    calc();
    const handler = () => calc();
    window.addEventListener("pinz_chat_new", handler);
    const id = window.setInterval(calc, 3000);
    return () => { window.removeEventListener("pinz_chat_new", handler); window.clearInterval(id); };
  }, [user?.id]);

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!btnRef.current) return;
    btnRef.current.setPointerCapture(e.pointerId);
    movedRef.current = false;
    setDragging(true);
    startRef.current = { pointerX: e.clientX, pointerY: e.clientY, baseX: pos.x, baseY: pos.y, pid: e.pointerId };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const s = startRef.current;
    if (!s || s.pid !== e.pointerId) return;
    const dx = e.clientX - s.pointerX;
    const dy = e.clientY - s.pointerY;
    if (!movedRef.current && Math.abs(dx) + Math.abs(dy) > 5) movedRef.current = true;
    setPos(clampPos({ x: s.baseX + dx, y: s.baseY + dy }));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const s = startRef.current;
    if (!s || s.pid !== e.pointerId) return;
    try { btnRef.current?.releasePointerCapture(e.pointerId); } catch {}
    setDragging(false);
    startRef.current = null;
    if (movedRef.current) {
      try { localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch {}
    } else {
      navigate("/chat");
    }
  };

  // Hide on these routes (already on chat, login, admin uses its own panel).
  if (!user) return null;
  if (isAdmin || isOwner) return null;
  if (location === "/login" || location.startsWith("/chat")) return null;

  return (
    <button
      ref={btnRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        width: FAB_SIZE,
        height: FAB_SIZE,
        touchAction: "none",
        cursor: dragging ? "grabbing" : "grab",
        transition: dragging ? "none" : "box-shadow .2s, transform .15s",
      }}
      className="z-[60] rounded-full bg-gradient-to-br from-primary to-purple-600 text-white shadow-[0_10px_30px_-5px_rgba(168,85,247,0.55)] hover:shadow-[0_14px_40px_-5px_rgba(168,85,247,0.7)] active:scale-95 flex items-center justify-center select-none"
      title="Live Chat (drag untuk pindah)"
      aria-label="Live Chat"
    >
      <MessageCircle className="w-6 h-6" />
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-extrabold flex items-center justify-center border-2 border-background">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
      <span className="absolute inset-0 rounded-full ring-2 ring-white/20 pointer-events-none" />
    </button>
  );
}
