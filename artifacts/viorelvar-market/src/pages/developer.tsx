import React from "react";
import { Link } from "wouter";
import { Footer } from "@/components/layout/navbar";
import { HelpBar } from "@/components/help-bar";
import { ArrowLeft, Code2, Globe, Github } from "lucide-react";

export default function Developer() {
  return (
    <div className="min-h-screen flex flex-col noise-bg">
      <header className="sticky top-0 z-40 w-full border-b border-border/30 bg-background/80 backdrop-blur">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/faq" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Kembali
          </Link>
          <span className="text-sm font-bold tracking-tight text-foreground">Pengembang</span>
          <div className="w-20" />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center py-16 pb-44 px-4">
        <div className="w-full max-w-sm">
          <div className="rounded-2xl border border-border/50 bg-muted/10 p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mx-auto mb-5 shadow-[0_0_24px_rgba(163,230,53,0.3)]">
              <Code2 className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold mb-1">VIORELVARMARKET</h1>
            <p className="text-xs text-muted-foreground mb-6">Platform Digital Top-Up & Voucher</p>

            <div className="space-y-3 text-left">
              <div className="flex items-center justify-between py-2 border-b border-border/40">
                <span className="text-xs text-muted-foreground">Versi</span>
                <span className="text-xs font-mono font-semibold">v1.0.0</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/40">
                <span className="text-xs text-muted-foreground">Stack</span>
                <span className="text-xs font-mono font-semibold">React + Vite</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/40">
                <span className="text-xs text-muted-foreground">Status</span>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-green-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                  Online
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-xs text-muted-foreground">Build</span>
                <span className="text-xs font-mono font-semibold">2026</span>
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-border/40">
              <p className="text-xs text-muted-foreground">
                Dibuat khusus untuk kebutuhan transaksi digital yang cepat, aman, dan otomatis.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
      <HelpBar />
    </div>
  );
}
