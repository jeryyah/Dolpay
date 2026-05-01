import React, { useEffect, useState } from "react";
import { Zap, Flame, ShieldCheck, Heart } from "lucide-react";
import { Product } from "@/data/products";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { BuyModal } from "@/components/buy-modal";
import { applyOverride } from "@/lib/storage";
import { useAuth } from "@/lib/auth-context";
import { isWishlisted, toggleWishlist } from "@/lib/extra-storage";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product: rawProduct }: ProductCardProps) {
  const product = applyOverride(rawProduct);
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [wished, setWished] = useState(false);
  useEffect(() => { if (user) setWished(isWishlisted(user.id, product.id)); }, [user?.id, product.id]);

  const handleHeart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    setWished(toggleWishlist(user.id, product.id));
  };

  return (
    <>
      <div
        onClick={() => setShowModal(true)}
        className="group relative bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 transition-all duration-300 hover:shadow-[0_0_20px_rgba(242,194,92,0.18)] hover:-translate-y-1 cursor-pointer"
      >
        {/* Wishlist heart */}
        <button
          onClick={handleHeart}
          className={`absolute top-3 left-3 z-20 w-8 h-8 rounded-full backdrop-blur-md flex items-center justify-center transition-all
            ${wished ? "bg-rose-500 text-white shadow-lg shadow-rose-500/40 scale-110" : "bg-black/60 text-white/80 hover:bg-rose-500 hover:text-white hover:scale-110"}`}
          aria-label="Wishlist"
        >
          <Heart className="w-4 h-4" fill={wished ? "white" : "none"} />
        </button>
        {product.isHot && (
          <div className="absolute top-3 right-3 z-10">
            <Badge className="bg-destructive text-destructive-foreground font-bold border-none clip-path-slant rounded-none flex items-center gap-1 px-2 py-0.5">
              <Flame className="w-3 h-3" /> HOT
            </Badge>
          </div>
        )}

        <div className="aspect-[4/3] w-full overflow-hidden relative bg-muted">
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent z-10" />
          <img
            src={product.imageUrl}
            alt={product.title}
            loading="lazy"
            decoding="async"
            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500 ease-out"
          />
        </div>

        <div className="p-4 relative z-20 -mt-8">
          <div className="bg-background border border-border rounded-lg p-3 shadow-md">
            <p className="text-xs text-muted-foreground font-mono mb-1 flex items-center gap-1">
              <Zap className="w-3 h-3 text-primary" /> {product.publisher}
            </p>
            <h3 className="font-bold text-foreground line-clamp-1 mb-2 group-hover:text-primary transition-colors">
              {product.title}
            </h3>

            <div className="flex items-end justify-between mt-4">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Mulai dari</p>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg text-primary leading-none">
                    {formatCurrency(product.price)}
                  </span>
                  {product.originalPrice && (
                    <span className="text-xs text-muted-foreground line-through">
                      {formatCurrency(product.originalPrice)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-green-500" /> Auto
              </span>
              <span>Terjual {product.soldCount.toLocaleString("id-ID")}</span>
            </div>
          </div>
        </div>
      </div>

      {showModal && <BuyModal product={product} onClose={() => setShowModal(false)} />}
    </>
  );
}
