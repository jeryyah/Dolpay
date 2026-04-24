import React, { useEffect, useState } from "react";
import { Heart, ShoppingBag, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Navbar, Footer } from "@/components/layout/navbar";
import { ProductCard } from "@/components/product-card";
import { getAllProducts } from "@/lib/storage";
import { getWishlist } from "@/lib/extra-storage";

export default function Wishlist() {
  const { user } = useAuth();
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    if (user) setIds(getWishlist(user.id));
  }, [user?.id]);

  const items = getAllProducts().filter((p) => ids.includes(p.id));

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        <Link href="/">
          <a className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="w-4 h-4" /> Beranda
          </a>
        </Link>

        <div className="mb-6 flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center shadow-lg shadow-rose-500/30">
            <Heart className="w-6 h-6 text-white" fill="white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold">Wishlist</h1>
            <p className="text-sm text-muted-foreground">Produk favorit yang kamu simpan</p>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-12 text-center">
            <Heart className="w-12 h-12 mx-auto mb-3 text-muted-foreground/40" />
            <p className="font-bold mb-1">Belum ada wishlist</p>
            <p className="text-sm text-muted-foreground mb-4">Tap ikon hati di produk untuk menambah ke wishlist</p>
            <Link href="/">
              <a className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold">
                <ShoppingBag className="w-4 h-4" /> Jelajahi Produk
              </a>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
