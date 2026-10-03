import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import ProductCard from "@/components/ProductCard";

export default function Catalog() {
  const [params, setParams] = useSearchParams();
  const [cats, setCats] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState(params.get("sort") || "newest");
  const [search, setSearch] = useState(params.get("search") || "");
  const category = params.get("category") || "";
  const onSale = params.get("on_sale") === "true";
  const isNew = params.get("is_new") === "true";
  const featured = params.get("featured") === "true";

  useEffect(() => {
    api.get("/categories").then(({ data }) => setCats(data));
  }, []);

  useEffect(() => {
    setLoading(true);
    const q = new URLSearchParams();
    if (category) q.set("category_id", category);
    if (onSale) q.set("on_sale", "true");
    if (isNew) q.set("is_new", "true");
    if (featured) q.set("featured", "true");
    if (search) q.set("search", search);
    q.set("sort", sort);
    api.get(`/products?${q.toString()}`).then(({ data }) => setProducts(data)).finally(() => setLoading(false));
  }, [category, onSale, isNew, featured, search, sort]);

  const activeCat = cats.find((c) => c.id === category);

  const setFilter = (key, val) => {
    const p = new URLSearchParams(params);
    if (val) p.set(key, val); else p.delete(key);
    setParams(p);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-10 animate-fade-up">
      <div className="mb-10">
        <h1 className="font-heading text-4xl sm:text-6xl font-extrabold uppercase tracking-tighter text-white">
          {activeCat ? activeCat.name : onSale ? "Ofertas" : isNew ? "Nuevos" : featured ? "Destacados" : "Catálogo"}
        </h1>
        <p className="mt-2 font-mono text-xs uppercase tracking-widest text-zinc-500">{products.length} productos</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-8">
        <aside className="space-y-6">
          <div>
            <h3 className="font-mono text-xs uppercase tracking-widest text-zinc-500 mb-3">Buscar</h3>
            <input data-testid="catalog-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="w-full bg-[#1C1C20] border border-[#27272A] focus:border-[#E60023] text-white placeholder-zinc-600 text-sm px-4 py-3 outline-none" />
          </div>
          <div>
            <h3 className="font-mono text-xs uppercase tracking-widest text-zinc-500 mb-3">Categoría</h3>
            <div className="flex flex-col gap-2">
              <button onClick={() => setFilter("category", "")} data-testid="filter-cat-all" className={`text-left text-sm py-2 border-l-2 pl-3 transition ${!category ? "border-[#E60023] text-white" : "border-transparent text-zinc-400 hover:text-white"}`}>Todas</button>
              {cats.map((c) => (
                <button key={c.id} onClick={() => setFilter("category", c.id)} data-testid={`filter-cat-${c.slug}`} className={`text-left text-sm py-2 border-l-2 pl-3 transition ${category === c.id ? "border-[#E60023] text-white" : "border-transparent text-zinc-400 hover:text-white"}`}>
                  {c.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-mono text-xs uppercase tracking-widest text-zinc-500 mb-3">Filtros rápidos</h3>
            <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer py-1"><input type="checkbox" checked={onSale} onChange={(e) => setFilter("on_sale", e.target.checked ? "true" : "")} className="accent-[#E60023]" /> En oferta</label>
            <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer py-1"><input type="checkbox" checked={isNew} onChange={(e) => setFilter("is_new", e.target.checked ? "true" : "")} className="accent-[#E60023]" /> Nuevos</label>
            <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer py-1"><input type="checkbox" checked={featured} onChange={(e) => setFilter("featured", e.target.checked ? "true" : "")} className="accent-[#E60023]" /> Destacados</label>
          </div>
          <div>
            <h3 className="font-mono text-xs uppercase tracking-widest text-zinc-500 mb-3">Ordenar</h3>
            <select value={sort} onChange={(e) => setSort(e.target.value)} data-testid="catalog-sort" className="w-full bg-[#1C1C20] border border-[#27272A] text-white text-sm px-3 py-3 outline-none">
              <option value="newest">Más nuevos</option>
              <option value="price_asc">Precio: menor a mayor</option>
              <option value="price_desc">Precio: mayor a menor</option>
              <option value="name">Nombre</option>
            </select>
          </div>
        </aside>

        <div>
          {loading ? (
            <div className="font-mono text-xs uppercase tracking-widest text-zinc-500">Cargando...</div>
          ) : products.length === 0 ? (
            <div className="border border-[#27272A] p-12 text-center">
              <p className="font-heading text-2xl text-white uppercase">No encontramos productos</p>
              <p className="text-zinc-500 mt-2 text-sm">Probá cambiar los filtros o la búsqueda.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6">
              {products.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
