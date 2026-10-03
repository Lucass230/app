import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { formatARS } from "@/lib/api";

export default function Cart() {
  const { items, subtotal, total, discount, update } = useCart();
  const { user } = useAuth();
  const nav = useNavigate();

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-6 py-20 text-center">
        <h1 className="font-heading text-3xl uppercase text-white">Tu carrito</h1>
        <p className="mt-4 text-zinc-400">Iniciá sesión para ver tu carrito y comprar.</p>
        <Link to="/login" className="inline-block mt-6 bg-[#E60023] text-white px-6 py-3 font-mono text-xs uppercase tracking-widest">Ingresar</Link>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="max-w-xl mx-auto px-6 py-20 text-center">
        <h1 className="font-heading text-3xl uppercase text-white">Tu carrito está vacío</h1>
        <p className="mt-4 text-zinc-400">Explorá el catálogo y empezá a agregar.</p>
        <Link to="/productos" data-testid="go-catalog-btn" className="inline-block mt-6 bg-[#E60023] text-white px-6 py-3 font-mono text-xs uppercase tracking-widest">Ir al catálogo</Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-8 sm:py-10 animate-fade-up">
      <h1 className="font-heading font-extrabold uppercase tracking-tighter text-white mb-6 sm:mb-8 break-words" style={{ fontSize: "clamp(2rem, 10vw, 4rem)" }}>Carrito</h1>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 lg:gap-8">
        <div className="space-y-3 min-w-0">
          {items.map((it, idx) => (
            <div key={idx} data-testid={`cart-item-${it.product_id}`} className="flex gap-3 sm:gap-4 border border-[#27272A] bg-[#121215] p-3 sm:p-4 min-w-0">
              <img src={it.product.main_image} alt="" className="w-16 h-16 sm:w-24 sm:h-24 object-cover shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="font-body font-medium text-white text-sm sm:text-base break-words line-clamp-2">{it.product.name}</h3>
                <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mt-1 flex flex-wrap gap-x-3">
                  {it.variant_color && <span>Color: {it.variant_color}</span>}
                  {it.variant_size && <span>Talle: {it.variant_size}</span>}
                </p>
                <div className="mt-3 flex items-center gap-2 sm:gap-3 flex-wrap">
                  <div className="flex items-center border border-[#27272A]">
                    <button onClick={() => update(it.product_id, Math.max(1, it.quantity - 1), it.variant_color, it.variant_size)} className="p-2 text-zinc-300 hover:text-white"><Minus size={12} /></button>
                    <span className="font-mono text-xs w-8 text-center">{it.quantity}</span>
                    <button onClick={() => update(it.product_id, it.quantity + 1, it.variant_color, it.variant_size)} className="p-2 text-zinc-300 hover:text-white"><Plus size={12} /></button>
                  </div>
                  <button onClick={() => update(it.product_id, 0, it.variant_color, it.variant_size)} data-testid={`remove-${it.product_id}`} className="p-2 text-zinc-500 hover:text-[#E60023]">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="text-right shrink-0 min-w-0">
                <p className="font-mono font-bold text-white text-sm sm:text-base whitespace-nowrap">{formatARS(it.product.final_price * it.quantity)}</p>
                {it.product.discount_percent > 0 && <p className="font-mono text-[10px] sm:text-xs text-zinc-500 line-through whitespace-nowrap">{formatARS(it.product.price * it.quantity)}</p>}
              </div>
            </div>
          ))}
        </div>
        <aside className="h-fit border border-[#27272A] bg-[#121215] p-5 sm:p-6 lg:sticky lg:top-20">
          <h3 className="font-mono text-xs uppercase tracking-widest text-zinc-500 mb-5">Resumen</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between text-zinc-300"><span>Subtotal</span><span className="font-mono whitespace-nowrap">{formatARS(subtotal)}</span></div>
            {discount > 0 && <div className="flex justify-between text-[#E60023]"><span>Descuento</span><span className="font-mono whitespace-nowrap">-{formatARS(discount)}</span></div>}
            <div className="border-t border-[#27272A] pt-3 flex justify-between font-bold text-white text-base sm:text-lg"><span>Total</span><span className="font-mono whitespace-nowrap">{formatARS(total)}</span></div>
          </div>
          <button onClick={() => nav("/checkout")} data-testid="go-checkout-btn" className="w-full mt-6 bg-[#E60023] hover:bg-[#FF1E27] text-white font-body font-bold text-sm uppercase tracking-wider py-4 shadow-[0_0_20px_rgba(230,0,35,0.3)]">Finalizar compra</button>
        </aside>
      </div>
    </div>
  );
}
