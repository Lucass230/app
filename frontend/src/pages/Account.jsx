import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import api, { formatARS } from "@/lib/api";

export default function Account() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState("info");
  const [orders, setOrders] = useState([]);
  const [points, setPoints] = useState({ points: 0, transactions: [] });

  useEffect(() => {
    if (!user) { nav("/login"); return; }
    api.get("/orders/mine").then(({ data }) => setOrders(data));
    api.get("/points/mine").then(({ data }) => setPoints(data));
  }, [user, nav]);

  if (!user) return null;
  const tabs = [
    { id: "info", label: "Información" },
    { id: "orders", label: `Pedidos (${orders.length})` },
    { id: "points", label: `Puntos (${points.points})` },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-12 py-8 sm:py-10 animate-fade-up">
      <h1 className="font-heading uppercase font-extrabold tracking-tighter text-white break-words" style={{ fontSize: "clamp(1.75rem, 8vw, 3rem)" }}>Hola, {user.first_name}</h1>
      <div className="mt-6 flex items-center gap-1 sm:gap-2 border-b border-[#27272A] overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} data-testid={`tab-${t.id}`} className={`shrink-0 px-3 sm:px-4 py-3 font-mono text-[10px] sm:text-xs uppercase tracking-widest border-b-2 transition ${tab === t.id ? "border-[#E60023] text-white" : "border-transparent text-zinc-500 hover:text-white"}`}>{t.label}</button>
        ))}
      </div>
      <div className="mt-8">
        {tab === "info" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Info label="Nombre" value={`${user.first_name} ${user.last_name}`} />
            <Info label="Email" value={user.email} />
            <Info label="Teléfono" value={user.phone || "-"} />
            <Info label="Dirección" value={user.address || "-"} />
            <Info label="Rol" value={user.role} />
          </div>
        )}
        {tab === "orders" && (
          orders.length === 0 ? <p className="text-zinc-500 text-sm">Todavía no realizaste pedidos.</p> :
          <div className="space-y-3">
            {orders.map((o) => (
              <div key={o.id} data-testid={`order-${o.order_number}`} className="border border-[#27272A] bg-[#121215] p-4 sm:p-5 flex items-center justify-between gap-3 min-w-0">
                <div className="min-w-0">
                  <p className="font-mono text-xs sm:text-sm text-white break-all">{o.order_number}</p>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{new Date(o.created_at).toLocaleDateString("es-AR")} · {o.items.length} items</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono font-bold text-white whitespace-nowrap">{formatARS(o.total)}</p>
                  <span className="font-mono text-[10px] uppercase bg-[#E60023]/10 text-[#E60023] px-2 py-0.5">{o.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === "points" && (
          <div>
            <div className="border border-[#27272A] bg-[#121215] p-8">
              <p className="font-mono text-xs uppercase tracking-widest text-zinc-500">Balance de puntos</p>
              <p className="font-heading text-6xl font-extrabold text-[#E60023] mt-2">{points.points}</p>
            </div>
            <h3 className="font-mono text-xs uppercase tracking-widest text-zinc-500 mt-8 mb-3">Movimientos</h3>
            {points.transactions.length === 0 ? <p className="text-sm text-zinc-500">Sin movimientos.</p> :
              <div className="space-y-2">
                {points.transactions.map((t) => (
                  <div key={t.id} className="border border-[#27272A] p-3 flex justify-between">
                    <span className="text-sm text-zinc-300">{t.type === "earn" ? "Ganaste" : "Canjeaste"} · {new Date(t.created_at).toLocaleDateString("es-AR")}</span>
                    <span className={`font-mono text-sm font-bold ${t.amount > 0 ? "text-[#10B981]" : "text-[#E60023]"}`}>{t.amount > 0 ? "+" : ""}{t.amount}</span>
                  </div>
                ))}
              </div>
            }
          </div>
        )}
      </div>
      <button onClick={logout} className="mt-10 font-mono text-xs uppercase tracking-widest text-zinc-500 hover:text-[#E60023]">Cerrar sesión</button>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="border border-[#27272A] p-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</p>
      <p className="text-white text-sm mt-1">{value}</p>
    </div>
  );
}
