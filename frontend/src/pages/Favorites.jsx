import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import ProductCard from "@/components/ProductCard";

export default function Favorites() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [favs, setFavs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => api.get("/favorites").then(({ data }) => setFavs(data)).finally(() => setLoading(false));

  useEffect(() => {
    if (!user) { nav("/login"); return; }
    load();
  }, [user, nav]);

  const toggle = async (pid) => {
    await api.delete(`/favorites/${pid}`);
    toast.success("Eliminado de favoritos");
    load();
  };

  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-10 animate-fade-up">
      <h1 className="font-heading text-4xl sm:text-6xl uppercase font-extrabold tracking-tighter text-white">Favoritos</h1>
      {loading ? <p className="mt-8 text-zinc-500 font-mono text-xs uppercase">Cargando...</p> :
        favs.length === 0 ? (
          <p className="mt-8 text-zinc-400">Todavía no tenés favoritos.</p>
        ) : (
          <div className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
            {favs.map((p) => <ProductCard key={p.id} product={p} isFavorite onFavorite={toggle} />)}
          </div>
        )
      }
    </div>
  );
}
