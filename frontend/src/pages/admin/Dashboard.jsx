import React, { useEffect, useState } from "react";
import api, { formatARS } from "@/lib/api";

export default function Dashboard() {
  const [s, setS] = useState(null);
  useEffect(() => { api.get("/admin/stats").then(({ data }) => setS(data)); }, []);
  if (!s) return <div className="text-zinc-500 font-mono text-xs uppercase">Cargando...</div>;
  const cards = [
    { label: "Pedidos totales", value: s.total_orders },
    { label: "Pendientes", value: s.pending_orders, accent: true },
    { label: "Confirmados", value: s.confirmed_orders },
    { label: "Productos", value: s.products },
    { label: "Clientes", value: s.customers },
    { label: "Ventas (confirmadas)", value: formatARS(s.sales_total) },
    { label: "Stock bajo", value: s.low_stock, accent: s.low_stock > 0 },
  ];
  return (
    <div>
      <h1 className="font-heading text-4xl uppercase font-extrabold tracking-tighter text-white">Dashboard</h1>
      <p className="font-mono text-xs uppercase tracking-widest text-zinc-500 mt-2">Resumen general de CATTO</p>
      <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} data-testid={`stat-${c.label}`} className={`border p-5 bg-[#121215] ${c.accent ? "border-[#E60023]" : "border-[#27272A]"}`}>
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{c.label}</p>
            <p className={`mt-3 font-heading text-4xl font-extrabold ${c.accent ? "text-[#E60023]" : "text-white"}`}>{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
