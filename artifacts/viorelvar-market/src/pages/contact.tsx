import React from "react";
import { Navbar, Footer } from "@/components/layout/navbar";
import { HelpBar } from "@/components/help-bar";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

const WA_NUMBER = "6287817256487";
const TG_USERNAME = "VIORELVAR321";

export default function Contact() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex flex-col noise-bg">
      <Navbar />
      <main className="flex-1 flex items-center justify-center py-20">
        <div className="container mx-auto px-4 max-w-md">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold tracking-tight mb-3">
              {t("contact_title")} <span className="text-primary">{t("contact_title2")}</span>
            </h1>
            <p className="text-muted-foreground text-sm">
              {t("contact_sub")}
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <a
              href={`https://wa.me/${WA_NUMBER}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button className="w-full h-14 text-base font-bold gap-3 bg-[#25D366] hover:bg-[#1ebe5d] text-white rounded-xl">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="w-6 h-6 fill-white">
                  <path d="M16 .5C7.439.5.5 7.439.5 16c0 2.832.742 5.545 2.154 7.934L.5 31.5l7.793-2.129A15.457 15.457 0 0 0 16 31.5C24.561 31.5 31.5 24.561 31.5 16S24.561.5 16 .5zm0 28.25a13.2 13.2 0 0 1-6.73-1.836l-.482-.287-4.626 1.264 1.238-4.51-.314-.5A13.25 13.25 0 1 1 16 28.75zm7.258-9.895c-.397-.199-2.352-1.16-2.717-1.293-.364-.132-.629-.199-.895.199-.265.397-1.028 1.293-1.26 1.558-.232.265-.464.299-.861.1-.397-.199-1.676-.618-3.193-1.972-1.18-1.053-1.977-2.353-2.208-2.75-.232-.397-.025-.612.174-.81.179-.177.397-.464.596-.695.199-.232.265-.397.397-.662.132-.265.066-.497-.033-.695-.1-.199-.895-2.156-1.226-2.95-.323-.773-.65-.668-.895-.68l-.762-.013c-.265 0-.695.1-1.06.497-.364.397-1.392 1.36-1.392 3.317 0 1.957 1.425 3.848 1.623 4.113.199.265 2.804 4.28 6.793 5.998.95.41 1.692.655 2.27.839.953.303 1.82.26 2.505.157.764-.114 2.352-.96 2.684-1.888.332-.928.332-1.723.232-1.888-.099-.166-.364-.265-.762-.464z"/>
                </svg>
                {t("contact_wa")}
              </Button>
            </a>

            <a
              href={`https://t.me/${TG_USERNAME}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button className="w-full h-14 text-base font-bold gap-3 bg-[#229ED9] hover:bg-[#1a8fc4] text-white rounded-xl">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="w-6 h-6 fill-white">
                  <path d="M16 .5C7.44.5.5 7.44.5 16S7.44 31.5 16 31.5 31.5 24.56 31.5 16 24.56.5 16 .5zm7.965 10.173-2.716 12.797c-.205.913-.744 1.138-1.508.708l-4.166-3.07-2.012 1.937c-.223.223-.408.408-.836.408l.298-4.24 7.694-6.952c.335-.298-.073-.464-.52-.166L8.894 17.92l-4.09-1.28c-.89-.28-.908-.89.185-1.316l15.98-6.163c.743-.27 1.391.166 1.996 1.012z"/>
                </svg>
                {t("contact_tg")}
              </Button>
            </a>
          </div>

          <div className="mt-8 text-center">
            <p className="text-xs text-muted-foreground">
              WA: +{WA_NUMBER} &nbsp;|&nbsp; Telegram: @{TG_USERNAME}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("contact_available")}
            </p>
          </div>
        </div>
      </main>
      <Footer />
      <HelpBar />
    </div>
  );
}
