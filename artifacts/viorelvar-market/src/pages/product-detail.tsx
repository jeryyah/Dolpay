import React, { useState } from "react";
import { useParams, Link } from "wouter";
import { Navbar, Footer } from "@/components/layout/navbar";
import { HelpBar } from "@/components/help-bar";
import { getProductByIdMerged } from "@/lib/storage";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Zap, ShieldCheck, Clock, ChevronLeft, CreditCard, Wallet, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PAYMENT_METHODS = [
  { id: "qris", name: "QRIS", fee: "Bebas Biaya", type: "E-Wallet", icon: <CreditCard className="w-5 h-5 text-primary" /> },
  { id: "dana", name: "DANA", fee: "Bebas Biaya", type: "E-Wallet", icon: <Wallet className="w-5 h-5 text-[#118EEA]" /> },
  { id: "gopay", name: "GoPay", fee: "Bebas Biaya", type: "E-Wallet", icon: <Wallet className="w-5 h-5 text-[#00AED6]" /> },
  { id: "bca", name: "BCA Virtual Account", fee: "Rp 4.000", type: "Bank Transfer", icon: <CreditCard className="w-5 h-5 text-[#0066AE]" /> },
  { id: "mandiri", name: "Mandiri Virtual Account", fee: "Rp 4.000", type: "Bank Transfer", icon: <CreditCard className="w-5 h-5 text-[#003D79]" /> },
];

export default function ProductDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const product = id ? getProductByIdMerged(id) : undefined;
  
  const [selectedPayment, setSelectedPayment] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  
  if (!product) {
    return (
      <div className="min-h-screen flex flex-col noise-bg">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center p-4">
          <AlertCircle className="w-16 h-16 text-destructive mb-4" />
          <h1 className="text-2xl font-bold mb-2">Produk Tidak Ditemukan</h1>
          <p className="text-muted-foreground mb-6">Produk yang Anda cari mungkin sudah dihapus atau tidak tersedia.</p>
          <Link href="/">
            <Button>Kembali ke Beranda</Button>
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const handlePurchase = () => {
    if (!playerId) {
      toast({ title: "Error", description: "User ID/Player ID wajib diisi", variant: "destructive" });
      return;
    }
    if (!selectedPayment) {
      toast({ title: "Error", description: "Pilih metode pembayaran terlebih dahulu", variant: "destructive" });
      return;
    }
    if (!whatsapp) {
      toast({ title: "Error", description: "Nomor WhatsApp wajib diisi", variant: "destructive" });
      return;
    }

    // Simulate purchase
    toast({ 
      title: "Pesanan Dibuat!", 
      description: "Mengarahkan ke halaman pembayaran...",
      className: "bg-primary text-primary-foreground border-none"
    });
    
    setTimeout(() => {
      window.location.href = "/history";
    }, 1500);
  };

  return (
    <div className="min-h-screen flex flex-col noise-bg">
      <Navbar />

      <main className="flex-1 py-8 container mx-auto px-4 max-w-6xl">
        <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-6 transition-colors">
          <ChevronLeft className="w-4 h-4 mr-1" /> Kembali ke Katalog
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Product Info */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-card border border-border rounded-xl overflow-hidden sticky top-24 shadow-lg shadow-black/20">
              <div className="aspect-square relative bg-muted">
                <img
                  src={product.imageUrl}
                  alt={product.title}
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                  className="object-cover w-full h-full"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
              </div>
              
              <div className="p-6 relative z-10 -mt-12">
                <div className="bg-background/80 backdrop-blur-md border border-border rounded-xl p-4 mb-4">
                  <h1 className="text-xl font-bold mb-1">{product.title}</h1>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Zap className="w-4 h-4 text-primary" /> {product.publisher}
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Harga</span>
                    <span className="font-bold text-xl text-primary">{formatCurrency(product.price)}</span>
                  </div>
                  
                  <div className="pt-4 border-t border-border grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <div className="text-xs">
                        <p className="text-muted-foreground">Proses</p>
                        <p className="font-bold">1-5 Detik</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-green-500" />
                      <div className="text-xs">
                        <p className="text-muted-foreground">Status</p>
                        <p className="font-bold text-green-500">Tersedia</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-primary" />
                Cara Pembelian
              </h3>
              <ol className="text-sm text-muted-foreground space-y-3 list-decimal list-inside pl-2">
                <li>Masukkan ID / Data akun dengan benar</li>
                <li>Pilih metode pembayaran yang diinginkan</li>
                <li>Masukkan nomor WhatsApp untuk notifikasi</li>
                <li>Klik Beli Sekarang dan selesaikan pembayaran</li>
                <li>Pesanan akan diproses otomatis dalam 1-5 detik</li>
              </ol>
            </div>
          </div>

          {/* Right Column: Form */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Step 1: Account Data */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold font-mono">1</div>
                <h2 className="text-xl font-bold">Masukkan Data Akun</h2>
              </div>
              
              {product.category === "game-topup" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="playerId">User ID / Player ID</Label>
                    <Input 
                      id="playerId" 
                      placeholder="Contoh: 12345678" 
                      className="h-12 bg-background border-border focus-visible:ring-primary"
                      value={playerId}
                      onChange={(e) => setPlayerId(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zoneId">Zone ID / Server (Jika ada)</Label>
                    <Input 
                      id="zoneId" 
                      placeholder="Contoh: 1234" 
                      className="h-12 bg-background border-border focus-visible:ring-primary"
                      value={zoneId}
                      onChange={(e) => setZoneId(e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground md:col-span-2 mt-1">
                    *Kesalahan penulisan ID sepenuhnya tanggung jawab pembeli.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="playerId">Email / Akun Tujuan</Label>
                  <Input 
                    id="playerId" 
                    placeholder="Masukkan email atau ID akun tujuan" 
                    className="h-12 bg-background border-border focus-visible:ring-primary"
                    value={playerId}
                    onChange={(e) => setPlayerId(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Step 2: Payment Method */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold font-mono">2</div>
                <h2 className="text-xl font-bold">Pilih Metode Pembayaran</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {PAYMENT_METHODS.map((method) => (
                  <div 
                    key={method.id}
                    onClick={() => setSelectedPayment(method.id)}
                    className={`cursor-pointer border rounded-xl p-4 flex items-center justify-between transition-all ${
                      selectedPayment === method.id 
                        ? "border-primary bg-primary/5 ring-1 ring-primary" 
                        : "border-border hover:border-primary/50 bg-background hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-card border border-border flex items-center justify-center">
                        {method.icon}
                      </div>
                      <div>
                        <p className="font-bold text-sm">{method.name}</p>
                        <p className="text-xs text-muted-foreground">{method.type}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm text-foreground">
                        {method.id === "bca" || method.id === "mandiri" 
                          ? formatCurrency(product.price + 4000) 
                          : formatCurrency(product.price)}
                      </p>
                      <p className="text-xs text-primary">{method.fee}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 3: Contact & Submit */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold font-mono">3</div>
                <h2 className="text-xl font-bold">Konfirmasi Pembelian</h2>
              </div>
              
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="whatsapp">Nomor WhatsApp</Label>
                  <Input 
                    id="whatsapp" 
                    placeholder="Contoh: 081234567890" 
                    className="h-12 bg-background border-border focus-visible:ring-primary"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Bukti pembayaran dan status pesanan akan dikirim ke WhatsApp ini.
                  </p>
                </div>

                <div className="p-4 bg-muted/30 border border-border rounded-xl space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Harga Produk</span>
                    <span>{formatCurrency(product.price)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Biaya Layanan</span>
                    <span>
                      {selectedPayment === "bca" || selectedPayment === "mandiri" 
                        ? formatCurrency(4000) 
                        : formatCurrency(0)}
                    </span>
                  </div>
                  <div className="pt-3 border-t border-border flex justify-between items-center">
                    <span className="font-bold">Total Pembayaran</span>
                    <span className="text-2xl font-bold text-primary">
                      {selectedPayment === "bca" || selectedPayment === "mandiri" 
                        ? formatCurrency(product.price + 4000) 
                        : formatCurrency(product.price)}
                    </span>
                  </div>
                </div>

                <Button 
                  size="lg" 
                  className="w-full h-14 text-lg font-bold bg-primary text-primary-foreground hover:bg-primary/90 clip-path-slant rounded-none"
                  onClick={handlePurchase}
                >
                  Beli Sekarang
                </Button>
              </div>
            </div>

          </div>
        </div>
      </main>

      <Footer />
      <HelpBar />
    </div>
  );
}
