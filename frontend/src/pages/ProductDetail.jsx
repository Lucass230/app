import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Heart, Minus, Plus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import api, { formatARS, formatErr } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";

export default function ProductDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const { add } = useCart();
  const [p, setP] = useState(null);
  const [img, setImg] = useState("");
  const [color, setColor] = useState(null);
  const [size, setSize] = useState(null);
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);
  const [isFav, setIsFav] = useState(false);

  useEffect(() => {
    api.get(`/products/${id}`).then(({ data }) => { setP(data); setImg(data.main_image); });
    if (user) api.get("/favorites").then(({ data }) => setIsFav(data.some(f => f.id === id))).catch(() => {});
  }, [id, user]);

  const variants = p?.variants || [];
  const colors = useMemo(() => [...new Set(variants.map((v) => v.color).filter(Boolean))], [variants]);
  const sizes = useMemo(() => [...new Set(variants.filter((v) => !color || v.color === color).map((v) => v.size).filter(Boolean))], [variants, color]);
  const activeVariant = variants.find((v) => (!color || v.color === color) && (!size || v.size === size));
  const stock = variants.length ? (activeVariant?.stock || 0) : (p?.stock || 0);

  const handleAdd = async () => {
    if (!user) { toast.error("Iniciá sesión para comprar"); nav("/login"); return; }
    if (colors.length && !color) { toast.error("Seleccioná un color"); return; }
    if (sizes.length && !size) { toast.error("Seleccioná un talle"); return; }
    if (stock <= 0) { toast.error("Sin stock"); return; }
    setAdding(true);
    try {
      await add(p.id, qty, color, size);
      toast.success("Agregado al carrito");
    } catch (e) { toast.error(formatErr(e)); } finally { setAdding(false); }
  };

  const toggleFav = async () => {
    if (!user) { nav("/login"); return; }
    if (isFav) { await api.delete(`/favorites/${id}`); setIsFav(false); }
    else { await api.post(`/favorites/${id}`); setIsFav(true); toast.success("Agregado a favoritos"); }
  };

  if (!p) return <div className="max-w-7xl mx-auto px-6 py-20 text-zinc-500 font-mono text-xs uppercase">Cargando...</div>;

  const hasDiscount = (p.discount_percent || 0) > 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-10 animate-fade-up">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div>
          <div className="relative bg-[#121215] border border-[#27272A] aspect-square overflow-hidden">
            {img && <img src={img} alt={p.name} className="w-full h-full object-cover" />}
            {hasDiscount && <span className="absolute top-4 left-4 bg-[#E60023] text-white font-mono text-xs font-bold px-3 py-1 uppercase">-{Math.round(p.discount_percent)}%</span>}
          </div>
          {p.images?.length > 1 && (
            <div className="grid grid-cols-5 gap-2 mt-3">
              {p.images.map((i) => (
                <button key={i} onClick={() => setImg(i)} className={`aspect-square bg-[#121215] border ${img === i ? "border-[#E60023]" : "border-[#27272A]"}`}>
                  <img src={i} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          {p.brand && <span className="font-mono text-xs uppercase tracking-widest text-zinc-500">{p.brand}</span>}
          <h1 data-testid="product-name" className="font-heading text-3xl sm:text-5xl font-extrabold uppercase tracking-tighter text-white mt-2">{p.name}</h1>
          <div className="flex items-baseline gap-3 mt-4">
            <span data-testid="product-final-price" className="font-mono font-bold text-white text-3xl">{formatARS(p.final_price)}</span>
            {hasDiscount && <span className="font-mono text-base text-zinc-500 line-through">{formatARS(p.price)}</span>}
            {hasDiscount && <span className="font-mono text-xs uppercase text-[#E60023] font-bold">AHORRÁ {formatARS(p.price - p.final_price)}</span>}
          </div>
          <p className="mt-6 text-zinc-300 text-sm leading-relaxed">{p.description || p.short_description}</p>

          {colors.length > 0 && (
            <div className="mt-8">
              <h3 className="font-mono text-xs uppercase tracking-widest text-zinc-500 mb-3">Color: {color || <span className="text-zinc-600">Elegí</span>}</h3>
              <div className="flex flex-wrap gap-2">
                {colors.map((c) => (
                  <button key={c} onClick={() => { setColor(c); setSize(null); }} data-testid={`color-${c}`} className={`px-4 py-2 border font-mono text-xs uppercase tracking-wider ${color === c ? "border-[#E60023] text-white bg-[#E60023]/10" : "border-[#27272A] text-zinc-400 hover:border-white"}`}>{c}</button>
                ))}
              </div>
            </div>
          )}

          {sizes.length > 0 && (
            <div className="mt-6">
              <h3 className="font-mono text-xs uppercase tracking-widest text-zinc-500 mb-3">Talle: {size || <span className="text-zinc-600">Elegí</span>}</h3>
              <div className="flex flex-wrap gap-2">
                {sizes.map((s) => {
                  const v = variants.find((v) => (!color || v.color === color) && v.size === s);
                  const disabled = !v || v.stock <= 0;
                  return (
                    <button key={s} disabled={disabled} onClick={() => setSize(s)} data-testid={`size-${s}`} className={`min-w-[48px] px-3 py-2 border font-mono text-xs uppercase ${size === s ? "border-[#E60023] text-white bg-[#E60023]/10" : disabled ? "border-[#27272A]/50 text-zinc-700 line-through cursor-not-allowed" : "border-[#27272A] text-zinc-300 hover:border-white"}`}>{s}</button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-8 flex items-center gap-4">
            <div className="flex items-center border border-[#27272A]">
              <button onClick={() => setQty(Math.max(1, qty - 1))} data-testid="qty-minus" className="p-3 text-zinc-300 hover:text-white"><Minus size={14} /></button>
              <span data-testid="qty-value" className="font-mono text-sm w-10 text-center">{qty}</span>
              <button onClick={() => setQty(qty + 1)} data-testid="qty-plus" className="p-3 text-zinc-300 hover:text-white"><Plus size={14} /></button>
            </div>
            <span className="font-mono text-xs uppercase text-zinc-500">
              {stock > 0 ? `${stock} disponibles` : "Sin stock"}
            </span>
          </div>

          <div className="mt-6 flex gap-3">
            <button onClick={handleAdd} disabled={adding || stock <= 0} data-testid="add-to-cart-btn" className="flex-1 bg-[#E60023] hover:bg-[#FF1E27] disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-body font-bold text-sm uppercase tracking-wider px-6 py-4 transition flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(230,0,35,0.3)]">
              <ShoppingBag size={16} /> {adding ? "Agregando..." : "Agregar al carrito"}
            </button>
            <button onClick={toggleFav} data-testid="fav-toggle" className={`p-4 border ${isFav ? "border-[#E60023] text-[#E60023]" : "border-[#27272A] text-zinc-300 hover:border-white"} transition`}>
              <Heart size={18} fill={isFav ? "#E60023" : "none"} />
            </button>
          </div>

          {Object.keys(p.attributes || {}).length > 0 && (
            <div className="mt-10 border-t border-[#27272A] pt-6">
              <h3 className="font-mono text-xs uppercase tracking-widest text-zinc-500 mb-4">Especificaciones</h3>
              <dl className="grid grid-cols-2 gap-y-2">
                {Object.entries(p.attributes).map(([k, v]) => (
                  <React.Fragment key={k}>
                    <dt className="font-mono text-xs uppercase text-zinc-500">{k}</dt>
                    <dd className="text-sm text-zinc-200">{String(v)}</dd>
                  </React.Fragment>
                ))}
              </dl>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
