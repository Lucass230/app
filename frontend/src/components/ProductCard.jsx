import React from "react";
import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { formatARS } from "@/lib/api";

export default function ProductCard({ product, onFavorite, isFavorite }) {
  const hasDiscount = (product.discount_percent || 0) > 0;
  return (
    <Link to={`/productos/${product.id}`} data-testid={`product-card-${product.id}`} className="product-card group relative bg-[#121215] border border-[#27272A] hover:border-[#E60023]/60 transition-all duration-300 flex flex-col overflow-hidden">
      <div className="relative aspect-[3/4] overflow-hidden bg-zinc-900">
        {product.main_image ? (
          <img src={product.main_image} alt={product.name} loading="lazy" className="product-img w-full h-full object-cover transition-transform duration-500 ease-out" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-700 font-mono text-xs">SIN IMAGEN</div>
        )}
        <div className="absolute top-3 left-3 flex flex-col gap-1 z-10">
          {hasDiscount && (
            <span className="bg-[#E60023] text-white font-mono text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider">
              -{Math.round(product.discount_percent)}%
            </span>
          )}
          {product.is_new && <span className="bg-white text-black font-mono text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider">NUEVO</span>}
          {product.is_featured && !product.is_new && <span className="bg-[#18181B] text-white border border-[#3F3F46] font-mono text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider">DESTACADO</span>}
        </div>
        {onFavorite && (
          <button onClick={(e) => { e.preventDefault(); onFavorite(product.id); }} data-testid={`fav-btn-${product.id}`} className="absolute top-3 right-3 p-2 bg-black/60 backdrop-blur-md text-white hover:text-[#E60023] transition-colors rounded-full z-10">
            <Heart size={16} fill={isFavorite ? "#E60023" : "none"} stroke={isFavorite ? "#E60023" : "currentColor"} />
          </button>
        )}
        <div className="quick-add absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black via-black/80 to-transparent opacity-0 transition-opacity duration-300">
          <div className="w-full bg-[#E60023] text-white font-body font-bold text-xs uppercase tracking-wider py-2.5 text-center">Ver producto</div>
        </div>
      </div>
      <div className="p-4 flex flex-col gap-1">
        {product.brand && <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{product.brand}</span>}
        <h3 className="font-body text-sm font-medium text-white line-clamp-2 min-h-[2.5rem]">{product.name}</h3>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="font-mono font-bold text-white text-base">{formatARS(product.final_price || product.price)}</span>
          {hasDiscount && <span className="font-mono text-xs text-zinc-500 line-through">{formatARS(product.price)}</span>}
        </div>
      </div>
    </Link>
  );
}
