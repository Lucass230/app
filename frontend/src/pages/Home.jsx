import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import api, { formatARS } from "@/lib/api";
import ProductCard from "@/components/ProductCard";

function Hero({ slides }) {
  const [idx, setIdx] = useState(0);
  const n = slides.length;
  useEffect(() => {
    if (!n) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % n), 6000);
    return () => clearInterval(t);
  }, [n]);
  if (!n) return null;
  const s = slides[idx];
  return (
    <section className="relative w-full h-[65vh] min-h-[480px] sm:h-[70vh] sm:min-h-[560px] lg:h-[80vh] overflow-hidden bg-black" data-testid="hero-section">
      {slides.map((sl, i) => (
        <div key={sl.id} className={`absolute inset-0 transition-opacity duration-700 ${i === idx ? "opacity-100" : "opacity-0"}`}>
          <img src={sl.image_url} alt={sl.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 hero-overlay" />
        </div>
      ))}
      <div className="relative z-10 h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 flex flex-col justify-end pb-14 sm:pb-20">
        {s.subtitle && <span className="font-mono text-[10px] sm:text-xs uppercase tracking-[0.3em] text-[#E60023] mb-3 sm:mb-4">{s.subtitle}</span>}
        <h1 className="font-heading font-extrabold uppercase tracking-tighter text-white leading-[0.9] max-w-4xl break-words" style={{ fontSize: "clamp(2rem, 10vw, 6rem)" }}>
          {s.title}
        </h1>
        {s.description && <p className="mt-4 sm:mt-6 font-body text-sm sm:text-base lg:text-lg text-zinc-300 max-w-xl">{s.description}</p>}
        {s.button_text && (
          <Link to={s.button_link || "/productos"} data-testid="hero-cta" className="mt-6 sm:mt-8 inline-flex items-center gap-2 bg-[#E60023] hover:bg-[#FF1E27] text-white font-body font-bold text-xs sm:text-sm uppercase tracking-wider px-5 sm:px-7 py-3 sm:py-4 w-fit transition-all shadow-[0_0_20px_rgba(230,0,35,0.3)]">
            {s.button_text}
            <ArrowRight size={14} />
          </Link>
        )}
      </div>
      {n > 1 && (
        <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 z-10 flex gap-2">
          <button onClick={() => setIdx((idx - 1 + n) % n)} data-testid="hero-prev" className="p-2 bg-black/60 border border-[#27272A] text-white hover:border-[#E60023]"><ChevronLeft size={16} /></button>
          <button onClick={() => setIdx((idx + 1) % n)} data-testid="hero-next" className="p-2 bg-black/60 border border-[#27272A] text-white hover:border-[#E60023]"><ChevronRight size={16} /></button>
        </div>
      )}
    </section>
  );
}

function CategoryGrid({ cats }) {
  if (!cats.length) return null;
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-12 sm:py-20">
      <div className="flex items-end justify-between mb-6 sm:mb-10 gap-3">
        <h2 className="font-heading text-2xl sm:text-4xl md:text-5xl font-bold uppercase tracking-tight text-white">Categorías</h2>
        <Link to="/productos" className="font-mono text-[10px] sm:text-xs uppercase tracking-widest text-zinc-400 hover:text-[#E60023] whitespace-nowrap">Ver todo →</Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
        {cats.slice(0, 8).map((c) => (
          <Link key={c.id} to={`/productos?category=${c.id}`} data-testid={`cat-tile-${c.slug}`} className="group relative h-[180px] sm:h-[260px] md:h-[320px] bg-[#121215] border border-[#27272A] overflow-hidden">
            {c.image_url && <img src={c.image_url} alt={c.name} className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" />}
            <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
            <div className="absolute bottom-0 left-0 p-3 sm:p-5 right-0">
              <h3 className="font-heading text-lg sm:text-xl md:text-2xl font-bold uppercase text-white tracking-tight break-words">{c.name}</h3>
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#E60023] group-hover:tracking-[0.3em] transition-all">Explorar →</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ProductRow({ title, products, viewAllLink }) {
  if (!products.length) return null;
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-10 sm:py-16">
      <div className="flex items-end justify-between mb-6 sm:mb-10 gap-3">
        <h2 className="font-heading text-2xl sm:text-4xl md:text-5xl font-bold uppercase tracking-tight text-white">{title}</h2>
        {viewAllLink && <Link to={viewAllLink} className="font-mono text-[10px] sm:text-xs uppercase tracking-widest text-zinc-400 hover:text-[#E60023] whitespace-nowrap">Ver todo →</Link>}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
        {products.slice(0, 8).map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
    </section>
  );
}

function WhyCatto() {
  const items = [
    { n: "01", t: "Curaduría propia", d: "Productos elegidos uno por uno, no un catálogo infinito." },
    { n: "02", t: "Puntos CATTO", d: "Ganás puntos en cada compra para canjear por descuentos reales." },
    { n: "03", t: "Atención directa", d: "WhatsApp con una persona real. Sin bots ni esperas." },
    { n: "04", t: "Pago flexible", d: "Transferencia con 15% off, efectivo o retiro en punto de encuentro." },
  ];
  return (
    <section className="bg-[#121215] border-y border-[#27272A] py-14 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
        <h2 className="font-heading text-2xl sm:text-4xl md:text-5xl font-bold uppercase tracking-tight text-white mb-8 sm:mb-12">¿Por qué CATTO<span className="text-[#E60023]">?</span></h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {items.map((i) => (
            <div key={i.n} className="border border-[#27272A] bg-[#0D0D0F] p-5 sm:p-6">
              <span className="font-mono text-xs text-[#E60023] font-bold">{i.n}</span>
              <h3 className="font-heading text-lg sm:text-xl font-bold text-white mt-3 uppercase">{i.t}</h3>
              <p className="font-body text-sm text-zinc-400 mt-2 leading-relaxed">{i.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const [slides, setSlides] = useState([]);
  const [cats, setCats] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [newArr, setNewArr] = useState([]);
  const [onSale, setOnSale] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [a, b, c, d, e] = await Promise.all([
          api.get("/carousel"),
          api.get("/categories"),
          api.get("/products?featured=true&limit=8"),
          api.get("/products?is_new=true&limit=8"),
          api.get("/products?on_sale=true&limit=8"),
        ]);
        setSlides(a.data);
        setCats(b.data);
        setFeatured(c.data);
        setNewArr(d.data);
        setOnSale(e.data);
      } catch {}
    })();
  }, []);

  return (
    <div className="animate-fade-up">
      <Hero slides={slides} />
      <CategoryGrid cats={cats} />
      <ProductRow title="Destacados" products={featured} viewAllLink="/productos?featured=true" />
      <WhyCatto />
      <ProductRow title="Nuevos" products={newArr} viewAllLink="/productos?is_new=true" />
      <ProductRow title="Ofertas" products={onSale} viewAllLink="/productos?on_sale=true" />
    </div>
  );
}
