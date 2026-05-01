import React from "react";
import { Link } from "wouter";
import { Footer } from "@/components/layout/navbar";
import { ChevronDown, ShieldAlert, ShoppingCart, ArrowLeft, Code2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

const HOW_TO_BUY = [
  {
    step: 1,
    title: "Pilih Produk",
    desc: "Buka halaman utama, cari produk yang ingin kamu beli (topup game, voucher, atau aplikasi premium), lalu klik produknya.",
  },
  {
    step: 2,
    title: "Masukkan Data Akun",
    desc: "Isi ID Game / Username akun kamu dengan benar. Pastikan tidak ada salah ketik — pesanan yang sudah diproses tidak bisa dibatalkan.",
  },
  {
    step: 3,
    title: "Pilih Nominal & Metode Bayar",
    desc: "Pilih nominal yang diinginkan, lalu pilih metode pembayaran (QRIS, DANA, GoPay, Transfer Bank, dll).",
  },
  {
    step: 4,
    title: "Lakukan Pembayaran",
    desc: "Selesaikan pembayaran sesuai instruksi yang muncul. Bayar sebelum batas waktu habis agar pesanan tidak dibatalkan otomatis.",
  },
  {
    step: 5,
    title: "Pesanan Diproses Otomatis",
    desc: "Setelah pembayaran dikonfirmasi, item akan masuk ke akun kamu dalam 1–3 detik secara otomatis.",
  },
  {
    step: 6,
    title: "Cek Transaksi",
    desc: "Kamu bisa cek status pesanan di menu 'Cek Transaksi'. Kalau ada kendala, hubungi support kami via Telegram.",
  },
];

const RULES = [
  "Dilarang menggunakan data akun orang lain tanpa izin.",
  "Dilarang melakukan chargeback / komplain palsu ke penyedia pembayaran.",
  "Dilarang mengisi ID/Username yang salah — tidak ada refund untuk kesalahan input.",
  "Dilarang melakukan spam order dengan tujuan penipuan.",
  "Dilarang menggunakan akun curian atau hasil phishing untuk bertransaksi.",
  "Pesanan yang sudah diproses tidak bisa dibatalkan atau direfund kecuali terbukti error dari sistem kami.",
  "Kami berhak memblokir akun/nomor yang terbukti melanggar aturan tanpa pemberitahuan.",
  "Transaksi yang mencurigakan akan dihentikan dan dilaporkan ke pihak berwajib.",
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border/60 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-semibold hover:bg-muted/40 transition-colors"
      >
        <span>{q}</span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 ml-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed border-t border-border/40 pt-3">
          {a}
        </div>
      )}
    </div>
  );
}

const FAQS = [
  { q: "Berapa lama item masuk ke akun saya?", a: "Proses otomatis, biasanya 1–3 detik setelah pembayaran dikonfirmasi. Jika lebih dari 5 menit, segera hubungi support kami." },
  { q: "Apakah ada refund jika saya salah input ID?", a: "Tidak ada refund untuk kesalahan input data. Pastikan ID/Username kamu benar sebelum melakukan pembayaran." },
  { q: "Metode pembayaran apa saja yang tersedia?", a: "Kami menerima QRIS, DANA, GoPay, BCA Virtual Account, dan Mandiri Virtual Account." },
  { q: "Apakah transaksi di sini aman?", a: "Ya, semua transaksi dilindungi enkripsi SSL. Data pembayaran kamu tidak kami simpan." },
  { q: "Bagaimana jika pesanan saya gagal?", a: "Jika item tidak masuk dalam 10 menit, hubungi support via Telegram dengan menyertakan nomor transaksi kamu." },
  { q: "Apakah ada biaya tambahan?", a: "Tergantung metode pembayaran. QRIS, DANA, dan GoPay bebas biaya. Transfer bank dikenakan biaya admin Rp 4.000." },
];

export default function FAQ() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex flex-col noise-bg">
      {/* Custom minimal header — no navbar */}
      <header className="sticky top-0 z-40 w-full border-b border-border/30 bg-background/80 backdrop-blur">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            {t("faq_back")}
          </Link>
          <span className="text-sm font-bold tracking-tight text-foreground">{t("faq_title")}</span>
          <Link href="/developer" className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors border border-primary/30 px-3 py-1.5 rounded-full">
            <Code2 className="w-3.5 h-3.5" />
            {t("faq_dev")}
          </Link>
        </div>
      </header>

      <main className="flex-1 py-10 pb-44">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold tracking-tight mb-3">
              {t("faq_title")}
            </h1>
            <p className="text-muted-foreground text-sm">
              {t("faq_sub")}
            </p>
          </div>

          {/* Cara Beli */}
          <section className="mb-12">
            <div className="flex items-center gap-2 mb-5">
              <ShoppingCart className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold">{t("faq_how_title")}</h2>
            </div>
            <div className="flex flex-col gap-4">
              {HOW_TO_BUY.map((item) => (
                <div key={item.step} className="flex gap-4 items-start bg-muted/20 border border-border/50 rounded-xl p-4">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">
                    {item.step}
                  </div>
                  <div>
                    <p className="font-semibold text-sm mb-1">{item.title}</p>
                    <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Larangan */}
          <section className="mb-12">
            <div className="flex items-center gap-2 mb-5">
              <ShieldAlert className="w-5 h-5 text-destructive" />
              <h2 className="text-lg font-bold">{t("faq_rules_title")}</h2>
            </div>
            <div className="bg-destructive/5 border border-destructive/30 rounded-xl p-5">
              <ul className="flex flex-col gap-3">
                {RULES.map((rule, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-destructive/20 text-destructive flex items-center justify-center text-xs font-bold shrink-0">
                      !
                    </span>
                    {rule}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* FAQ */}
          <section>
            <h2 className="text-lg font-bold mb-5">{t("faq_common")}</h2>
            <div className="flex flex-col gap-3">
              {FAQS.map((faq, i) => (
                <FaqItem key={i} q={faq.q} a={faq.a} />
              ))}
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
