import React, { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Send, ArrowLeft, MessageCircle, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Navbar } from "@/components/layout/navbar";
import { getChatThread, sendChat, markChatRead, type ChatMessage } from "@/lib/extra-storage";

export default function ChatPage() {
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const refresh = () => {
    if (!user) return;
    setMsgs(getChatThread(user.id));
    markChatRead(user.id, "admin"); // mark admin's messages as read by user
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2500);
    const handler = (e: any) => { if (e.detail?.userId === user?.id) refresh(); };
    window.addEventListener("pinz_chat_new", handler);
    return () => { clearInterval(t); window.removeEventListener("pinz_chat_new", handler); };
  }, [user?.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  if (!user) return null;

  const handleSend = () => {
    const t = draft.trim();
    if (!t) return;
    sendChat(user.id, "user", t);
    setDraft("");
    refresh();
    // Auto-reply demo dari admin (frontend-only)
    if (msgs.length === 0) {
      setTimeout(() => {
        sendChat(user.id, "admin", "Halo! Admin akan membalas pesan kamu sesegera mungkin. Sementara itu, kamu bisa cek menu Garansi & Replace Key untuk masalah key.");
        refresh();
      }, 1200);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <div className="container mx-auto px-4 py-4 max-w-2xl flex-1 flex flex-col">
        <Link href="/">
          <a className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
            <ArrowLeft className="w-4 h-4" /> Beranda
          </a>
        </Link>

        <div className="flex-1 flex flex-col bg-card border border-border rounded-3xl overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border flex items-center gap-3 bg-gradient-to-r from-primary/10 to-transparent">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-md">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm">Customer Support</p>
              <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Online
              </p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-background/40 min-h-[400px]">
            {msgs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
                <MessageCircle className="w-12 h-12 mb-3 opacity-40" />
                <p className="text-sm font-bold">Mulai chat dengan admin</p>
                <p className="text-xs mt-1">Kami akan balas secepatnya 24/7</p>
              </div>
            ) : (
              msgs.map((m) => (
                <div key={m.id} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-sm
                    ${m.from === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"}`}>
                    {m.from === "admin" && <p className="text-[10px] font-black text-primary mb-0.5 uppercase">Admin</p>}
                    <p className="whitespace-pre-wrap break-words">{m.text}</p>
                    <p className="text-[9px] opacity-60 mt-0.5 text-right">
                      {new Date(m.at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={endRef} />
          </div>

          {/* Composer */}
          <div className="border-t border-border p-3 flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
              placeholder="Ketik pesan..."
              className="flex-1 px-4 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              onClick={handleSend}
              disabled={!draft.trim()}
              className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold disabled:opacity-50 flex items-center gap-1.5"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
