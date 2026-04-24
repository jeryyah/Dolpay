import React from "react";
import { Link } from "wouter";
import { HelpCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

const WA_NUMBER = "6287817256487";
const TG_USERNAME = "VIORELVAR321";
const TG_CHANNEL = "https://t.me/GURUGAMING_UPDATE";

const ITEMS = [
  {
    label: "Telegram",
    href: `https://t.me/${TG_USERNAME}`,
    external: true,
    gradient: "from-[#1e90ff] to-[#0ecfff]",
    glow: "shadow-[0_0_18px_rgba(14,207,255,0.45)]",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="w-6 h-6 fill-white">
        <path d="M16 .5C7.44.5.5 7.44.5 16S7.44 31.5 16 31.5 31.5 24.56 31.5 16 24.56.5 16 .5zm7.965 10.173-2.716 12.797c-.205.913-.744 1.138-1.508.708l-4.166-3.07-2.012 1.937c-.223.223-.408.408-.836.408l.298-4.24 7.694-6.952c.335-.298-.073-.464-.52-.166L8.894 17.92l-4.09-1.28c-.89-.28-.908-.89.185-1.316l15.98-6.163c.743-.27 1.391.166 1.996 1.012z"/>
      </svg>
    ),
  },
  {
    label: "WhatsApp",
    href: `https://wa.me/${WA_NUMBER}`,
    external: true,
    gradient: "from-[#00c853] to-[#69f0ae]",
    glow: "shadow-[0_0_18px_rgba(0,200,83,0.45)]",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="w-6 h-6 fill-white">
        <path d="M16 .5C7.439.5.5 7.439.5 16c0 2.832.742 5.545 2.154 7.934L.5 31.5l7.793-2.129A15.457 15.457 0 0 0 16 31.5C24.561 31.5 31.5 24.561 31.5 16S24.561.5 16 .5zm0 28.25a13.2 13.2 0 0 1-6.73-1.836l-.482-.287-4.626 1.264 1.238-4.51-.314-.5A13.25 13.25 0 1 1 16 28.75zm7.258-9.895c-.397-.199-2.352-1.16-2.717-1.293-.364-.132-.629-.199-.895.199-.265.397-1.028 1.293-1.26 1.558-.232.265-.464.299-.861.1-.397-.199-1.676-.618-3.193-1.972-1.18-1.053-1.977-2.353-2.208-2.75-.232-.397-.025-.612.174-.81.179-.177.397-.464.596-.695.199-.232.265-.397.397-.662.132-.265.066-.497-.033-.695-.1-.199-.895-2.156-1.226-2.95-.323-.773-.65-.668-.895-.68l-.762-.013c-.265 0-.695.1-1.06.497-.364.397-1.392 1.36-1.392 3.317 0 1.957 1.425 3.848 1.623 4.113.199.265 2.804 4.28 6.793 5.998.95.41 1.692.655 2.27.839.953.303 1.82.26 2.505.157.764-.114 2.352-.96 2.684-1.888.332-.928.332-1.723.232-1.888-.099-.166-.364-.265-.762-.464z"/>
      </svg>
    ),
  },
  {
    label: "App",
    href: TG_CHANNEL,
    external: true,
    gradient: "from-[#ff6d00] to-[#ffca28]",
    glow: "shadow-[0_0_18px_rgba(255,109,0,0.45)]",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="w-6 h-6 fill-white">
        <path d="M16 2C8.268 2 2 8.268 2 16s6.268 14 14 14 14-6.268 14-14S23.732 2 16 2zm0 5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zm0 19.5c-3.5 0-6.612-1.613-8.7-4.14C8.8 20.49 12.23 19 16 19s7.2 1.49 8.7 3.36C22.612 24.887 19.5 26.5 16 26.5z"/>
      </svg>
    ),
  },
  {
    label: "FAQ",
    href: "/faq",
    external: false,
    gradient: "from-[#7c3aed] to-[#a78bfa]",
    glow: "shadow-[0_0_18px_rgba(124,58,237,0.45)]",
    icon: <HelpCircle className="w-6 h-6 text-white" />,
  },
];

function HelpItem({ item }: { item: typeof ITEMS[0] }) {
  const inner = (
    <div className="flex flex-col items-center gap-2 group">
      <div
        className={`w-13 h-13 w-[52px] h-[52px] rounded-2xl bg-gradient-to-br ${item.gradient} ${item.glow} flex items-center justify-center transition-all duration-200 group-hover:scale-110 group-hover:brightness-110`}
      >
        {item.icon}
      </div>
      <span className="text-[11px] font-semibold text-muted-foreground/80 tracking-wide">{item.label}</span>
    </div>
  );

  if (item.external) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer">
        {inner}
      </a>
    );
  }
  return <Link href={item.href}>{inner}</Link>;
}

export function HelpBar() {
  const { t } = useTranslation();
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pb-5 px-4 pointer-events-none">
      <div
        className="pointer-events-auto w-full max-w-[340px] rounded-3xl overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(20,20,28,0.97), rgba(28,28,40,0.97))",
          boxShadow: "0 8px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

        <div className="px-5 pt-4 pb-5">
          <div className="flex items-center justify-center gap-1.5 mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <p className="text-xs font-bold tracking-widest text-muted-foreground/70 uppercase">{t("help_label")}</p>
          </div>

          <div className="flex items-center justify-around">
            {ITEMS.map((item) => (
              <HelpItem key={item.label} item={item} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
