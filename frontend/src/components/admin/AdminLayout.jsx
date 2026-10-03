import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, Package, Tags, ShoppingBag, Users, Image, Settings, LogOut, ExternalLink, Ticket } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const nav = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/productos", label: "Productos", icon: Package },
  { to: "/admin/categorias", label: "Categorías", icon: Tags },
  { to: "/admin/pedidos", label: "Pedidos", icon: ShoppingBag },
  { to: "/admin/clientes", label: "Clientes", icon: Users },
  { to: "/admin/carrusel", label: "Carrusel", icon: Image },
  { to: "/admin/cupones", label: "Cupones", icon: Ticket },
  { to: "/admin/configuracion", label: "Configuración", icon: Settings },
];

export default function AdminLayout() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();

  if (loading) return <div className="min-h-screen bg-[#0D0D0F] flex items-center justify-center text-zinc-500 font-mono text-xs uppercase">Cargando...</div>;
  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-[#0D0D0F] flex flex-col items-center justify-center gap-4 text-center p-6">
        <h1 className="font-heading text-4xl uppercase text-white">Acceso restringido</h1>
        <p className="text-zinc-400">Esta sección es solo para administradores.</p>
        <button onClick={() => navigate("/login")} className="bg-[#E60023] text-white px-6 py-3 font-mono text-xs uppercase tracking-widest">Ingresar</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D0D0F] flex w-full max-w-full overflow-x-hidden">
      <aside className="hidden lg:flex w-64 bg-[#0D0D0F] border-r border-[#27272A] flex-col fixed h-full">
        <div className="p-6 border-b border-[#27272A]">
          <h2 className="font-heading text-2xl font-extrabold tracking-tighter text-white">CATTO<span className="text-[#E60023]">.</span></h2>
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mt-1">Panel admin</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} data-testid={`admin-nav-${n.label.toLowerCase()}`} className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 font-body text-sm transition ${isActive ? "bg-[#E60023] text-white" : "text-zinc-400 hover:text-white hover:bg-[#18181B]"}`}>
              <n.icon size={16} /> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-[#27272A] space-y-1">
          <a href="/" className="flex items-center gap-3 px-3 py-2 text-zinc-400 hover:text-white text-sm"><ExternalLink size={14} /> Ver tienda</a>
          <button onClick={logout} data-testid="admin-logout" className="w-full flex items-center gap-3 px-3 py-2 text-zinc-400 hover:text-[#E60023] text-sm"><LogOut size={14} /> Cerrar sesión</button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 w-full lg:ml-64 min-h-screen">
        <div className="lg:hidden sticky top-0 z-30 bg-[#0D0D0F] border-b border-[#27272A] flex items-center justify-between px-3 py-3 gap-2">
          <h2 className="font-heading text-lg font-extrabold tracking-tighter text-white shrink-0">CATTO<span className="text-[#E60023]">.</span></h2>
          <div className="flex-1 min-w-0 overflow-x-auto">
            <div className="flex gap-1.5 w-max">
              {nav.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `whitespace-nowrap px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wider ${isActive ? "bg-[#E60023] text-white" : "text-zinc-400 border border-[#27272A]"}`}>{n.label}</NavLink>
              ))}
            </div>
          </div>
          <button onClick={logout} data-testid="admin-logout-mobile" className="shrink-0 p-2 text-zinc-400 hover:text-[#E60023]"><LogOut size={16} /></button>
        </div>
        <div className="p-4 sm:p-6 lg:p-10 min-w-0 max-w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
