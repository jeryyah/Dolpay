import React, { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Send, ArrowLeft, MessageCircle, ShieldCheck, Trash2, Paperclip, X, Image as ImageIcon, FileText, Download } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Navbar } from "@/components/layout/navbar";
import {
  getChatThread,
  sendChat,
  markChatRead,
  startChatSync,
  resetChatThread,
  type ChatMessage,
  type ChatAttachment,
} from "@/lib/extra-storage";

const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export default function ChatPage() {
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<ChatAttachment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const refresh = () => {
    if (!user) return;
    setMsgs(getChatThread(user.id));
    markChatRead(user.id, "admin");
  };

  useEffect(() => {
    refresh();
    const stopSync = startChatSync(1500);
    const handler = () => refresh();
    window.addEventListener("pinz_chat_new", handler);
    return () => { stopSync(); window.removeEventListener("pinz_chat_new", handler); };
  }, [user?.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  if (!user) return null;

  const handlePickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > MAX_ATTACHMENT_BYTES) {
      setError(`File terlalu besar (${formatBytes(f.size)}). Maks 4 MB.`);
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(f);
      setPending({ name: f.name, type: f.type || "application/octet-stream", size: f.size, dataUrl });
      setError(null);
    } catch {
      setError("Gagal membaca file.");
    }
  };

  const handleSend = () => {
    const t = draft.trim();
    if (!t && !pending) return;
    sendChat(user.id, "user", t || (pending ? `[Lampiran] ${pending.name}` : ""), pending || undefined);
    setDraft("");
    setPending(null);
    setError(null);
    refresh();
  };

  const handleReset = () => {
    if (!confirm("Hapus seluruh riwayat chat dengan admin?\n\nAdmin akan diberi tahu bahwa kamu mereset chat.")) return;
    resetChatThread(user.id, "user", user.username);
    setMsgs(getChatThread(user.id));
  };

  const renderAttachment = (a: ChatAttachment, mine: boolean) => {
    const isImage = a.type.startsWith("image/");
    if (isImage) {
      return (
        <a href={a.dataUrl} target="_blank" rel="noreferrer" className="block mt-1 -mx-1 first:mt-0">
          <img
            src={a.dataUrl}
            alt={a.name}
            className="rounded-xl max-h-64 w-auto border border-white/10"
          />
        </a>
      );
    }
    return (
      <a
        href={a.dataUrl}
        download={a.name}
        className={`mt-1 inline-flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs font-semibold ${
          mine ? "border-white/30 bg-white/10" : "border-border bg-background/40"
        }`}
      >
        <FileText className="w-4 h-4 shrink-0" />
        <span className="truncate max-w-[180px]">{a.name}</span>
        <span className="opacity-70">({formatBytes(a.size)})</span>
        <Download className="w-3.5 h-3.5 shrink-0 opacity-70" />
      </a>
    );
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
            {msgs.length > 0 && (
              <button
                onClick={handleReset}
                title="Reset / hapus riwayat chat dengan admin"
                className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 transition"
              >
                <Trash2 className="w-3.5 h-3.5" /> Reset
              </button>
            )}
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
                    {m.text && !(m.attachment && m.text === `[Lampiran] ${m.attachment.name}`) && (
                      <p className="whitespace-pre-wrap break-words">{m.text}</p>
                    )}
                    {m.attachment && renderAttachment(m.attachment, m.from === "user")}
                    <p className="text-[9px] opacity-60 mt-0.5 text-right">
                      {new Date(m.at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={endRef} />
          </div>

          {/* Pending attachment preview */}
          {pending && (
            <div className="px-3 pt-2">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 border border-primary/30">
                {pending.type.startsWith("image/") ? (
                  <img src={pending.dataUrl} alt="" className="w-10 h-10 rounded object-cover" />
                ) : (
                  <FileText className="w-5 h-5 text-primary" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate">{pending.name}</p>
                  <p className="text-[10px] text-muted-foreground">{formatBytes(pending.size)}</p>
                </div>
                <button
                  onClick={() => setPending(null)}
                  className="p-1 rounded-lg hover:bg-rose-500/20 text-rose-400"
                  title="Batal lampiran"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
          {error && (
            <div className="px-4 pt-2">
              <p className="text-xs text-rose-400 font-semibold">{error}</p>
            </div>
          )}

          {/* Composer */}
          <div className="border-t border-border p-3 flex gap-2 items-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx,.txt,.zip,.rar"
              onChange={handlePickFile}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Lampirkan file/foto (maks 4 MB)"
              className="shrink-0 p-2.5 rounded-xl border border-border text-muted-foreground hover:text-primary hover:border-primary/50 transition"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
              placeholder={pending ? "Tulis caption (opsional)..." : "Ketik pesan..."}
              className="flex-1 px-4 py-2.5 rounded-xl bg-background border border-border text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              onClick={handleSend}
              disabled={!draft.trim() && !pending}
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
