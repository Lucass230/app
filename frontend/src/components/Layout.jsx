import React, { useState, useEffect } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ShoppingCart, Heart, User, Search, Menu, X, MessageCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import api from "@/lib/api";

function Marquee() {
  return (
    <div className="bg-[#E60023] text-white py-2 overflow-hidden whitespace-nowrap">
      <div className="animate-marquee inline-block font-mono text-xs font-bold uppercase tracking-widest">
        {Array(6).fill("ENVÍO A TODO EL PAÍS · 15% OFF EN TRANSFERENCIA · PUNTOS CATTO EN CADA COMPRA · ").join("")}
      </div>
    </div>
  );
}

function Header() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);

  const nav = [
    { to: "/", label: "Inicio" },
    { to: "/productos", label: "Catálogo" },
    { to: "/nuestra-historia", label: "Historia" },
  ];

  return (
    <>
      <Marquee />
      <header className="sticky top-0 z-40 bg-[#0D0D0F]/90 backdrop-blur-xl border-b border-[#27272A]">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
          <Link to="/" data-testid="brand-logo" className="font-heading text-xl sm:text-3xl font-extrabold tracking-tighter text-white hover:text-[#E60023] transition-colors shrink-0">
            CATTO<span className="text-[#E60023]">.</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === "/"} data-testid={`nav-${n.label.toLowerCase()}`} className={({ isActive }) =>
                `font-body text-xs uppercase tracking-widest transition-colors ${isActive ? "text-white" : "text-zinc-400 hover:text-white"}`
              }>
                {n.label}
              </NavLink>
            ))}
          </nav>

          <form onSubmit={(e) => { e.preventDefault(); window.location.href = `/productos?search=${encodeURIComponent(q)}`; }} className="hidden lg:flex items-center bg-[#1C1C20] border border-[#27272A] px-3 h-9 w-64">
            <Search size={14} className="text-zinc-500" />
            <input data-testid="header-search" value={q} onChange={(e) => setQ(e.target.value)} className="bg-transparent outline-none text-sm px-2 flex-1 text-white placeholder:text-zinc-500" placeholder="Buscar productos..." />
          </form>

          <div className="flex items-center gap-1 sm:gap-4 shrink-0">
            <Link to="/favoritos" data-testid="nav-favorites" className="p-2 text-zinc-300 hover:text-[#E60023] transition-colors">
              <Heart size={18} />
            </Link>
            <Link to="/carrito" data-testid="nav-cart" className="relative p-2 text-zinc-300 hover:text-white transition-colors">
              <ShoppingCart size={18} />
              {count > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-[#E60023] text-white text-[10px] font-mono font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center">
                  {count}
                </span>
              )}
            </Link>
            {user ? (
              <div className="hidden sm:flex items-center gap-2">
                <Link to={user.role === "admin" ? "/admin" : "/cuenta"} data-testid="nav-account" className="p-2 text-zinc-300 hover:text-white transition-colors">
                  <User size={18} />
                </Link>
                <button onClick={logout} data-testid="nav-logout" className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 hover:text-[#E60023] transition">Salir</button>
              </div>
            ) : (
              <Link to="/login" data-testid="nav-login" className="hidden sm:block font-mono text-xs uppercase tracking-widest text-zinc-300 hover:text-[#E60023] transition">
                Ingresar
              </Link>
            )}
            <button onClick={() => setOpen(!open)} data-testid="nav-menu-toggle" className="md:hidden p-2 text-white">
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {open && (
          <div className="md:hidden border-t border-[#27272A] bg-[#0D0D0F]">
            <div className="px-4 py-4 flex flex-col gap-3">
              {nav.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.to === "/"} data-testid={`mnav-${n.label.toLowerCase()}`} className="font-body text-sm uppercase tracking-wider text-zinc-300 hover:text-white py-2">
                  {n.label}
                </NavLink>
              ))}
              {user ? (
                <>
                  <Link to={user.role === "admin" ? "/admin" : "/cuenta"} className="font-body text-sm uppercase tracking-wider text-zinc-300 py-2">Mi cuenta</Link>
                  <button onClick={logout} className="text-left font-body text-sm uppercase tracking-wider text-[#E60023] py-2">Cerrar sesión</button>
                </>
              ) : (
                <>
                  <Link to="/login" className="font-body text-sm uppercase tracking-wider text-zinc-300 py-2">Ingresar</Link>
                  <Link to="/registro" className="font-body text-sm uppercase tracking-wider text-[#E60023] py-2">Crear cuenta</Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>
    </>
  );
}

function Footer() {
  const [s, setS] = useState({});
  useEffect(() => { api.get("/settings").then(({ data }) => setS(data)).catch(() => {}); }, []);
  return (
    <footer className="border-t border-[#27272A] bg-[#0D0D0F] mt-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-12 py-16 grid grid-cols-2 md:grid-cols-4 gap-10">
        <div className="col-span-2">
          <h2 className="font-heading text-3xl font-extrabold tracking-tighter text-white">CATTO<span className="text-[#E60023]">.</span></h2>
          <p className="mt-4 text-zinc-400 text-sm max-w-sm leading-relaxed">{s.store_description || "Tienda independiente de productos premium."}</p>
          <p className="mt-6 font-mono text-xs uppercase tracking-widest text-zinc-500">WhatsApp: {s.whatsapp_number || "3813007953"}</p>
        </div>
        <div>
          <h4 className="font-mono text-xs uppercase tracking-widest text-zinc-500 mb-4">Tienda</h4>
          <ul className="space-y-2 text-sm text-zinc-300">
            <li><Link to="/productos" className="hover:text-[#E60023]">Catálogo</Link></li>
            <li><Link to="/productos?on_sale=true" className="hover:text-[#E60023]">Ofertas</Link></li>
            <li><Link to="/productos?is_new=true" className="hover:text-[#E60023]">Nuevos</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-mono text-xs uppercase tracking-widest text-zinc-500 mb-4">Info</h4>
          <ul className="space-y-2 text-sm text-zinc-300">
            <li><Link to="/nuestra-historia" className="hover:text-[#E60023]">Nuestra historia</Link></li>
            <li><Link to="/cuenta" className="hover:text-[#E60023]">Mi cuenta</Link></li>
            <li><Link to="/favoritos" className="hover:text-[#E60023]">Favoritos</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-[#27272A]/60 py-6 text-center font-mono text-[10px] uppercase tracking-widest text-zinc-600">
        © {new Date().getFullYear()} CATTO — Hecho con dedicación.
      </div>
    </footer>
  );
}

function WhatsAppFloat() {
  const [s, setS] = useState({});
  useEffect(() => { api.get("/settings").then(({ data }) => setS(data)).catch(() => {}); }, []);
  const number = s.whatsapp_number || "5493813007953";
  const msg = encodeURIComponent("Hola CATTO, quiero hacer una consulta.");
  return (
    <a href={`https://wa.me/${number}?text=${msg}`} target="_blank" rel="noreferrer" data-testid="whatsapp-float" className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 bg-[#25D366] hover:bg-[#20ba5a] text-black p-3 sm:p-3.5 rounded-full shadow-[0_0_25px_rgba(37,211,102,0.4)] transition-all hover:scale-110">
      <MessageCircle size={20} fill="black" />
    </a>
  );
}

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0D0D0F] w-full max-w-full overflow-x-hidden">
      <Header />
      <main className="flex-1 w-full min-w-0">
        <Outlet />
      </main>
      <Footer />
      <WhatsAppFloat />
    </div>
  );
}
