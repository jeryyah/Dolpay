import React from "react";
import { Navbar, Footer } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

const TG_USERNAME = "vleorideCheats";

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
              Telegram: @{TG_USERNAME}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("contact_available")}
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
