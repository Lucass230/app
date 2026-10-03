import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import api, { formatARS, formatErr } from "@/lib/api";

const STATUSES = ["Pendiente", "Contactado", "Confirmado", "Pagado", "Preparando", "Entregado", "Cancelado"];

export default function Orders() {
  const [list, setList] = useState([]);
  const [sel, setSel] = useState(null);
  const load = () => api.get("/admin/orders").then(({ data }) => setList(data));
  useEffect(() => { load(); }, []);

  const update = async (o, status) => {
    try {
      await api.put(`/admin/orders/${o.id}/status`, { status });
      toast.success(`Pedido ${o.order_number} → ${status}`);
      load();
      if (sel && sel.id === o.id) setSel({ ...sel, status });
    } catch (e) { toast.error(formatErr(e)); }
  };

  return (
    <div>
      <h1 className="font-heading uppercase font-extrabold tracking-tighter text-white mb-6 sm:mb-8 break-words" style={{ fontSize: "clamp(1.75rem, 7vw, 2.5rem)" }}>Pedidos</h1>
      <div className="border border-[#27272A] overflow-x-auto -mx-4 sm:mx-0">
        <table className="w-full text-sm min-w-[560px]">
          <thead className="bg-[#18181B]"><tr>{["N°", "Cliente", "Items", "Total", "Pago", "Estado", "Fecha"].map(h => <th key={h} className="font-mono text-[10px] uppercase tracking-widest text-zinc-400 p-3 text-left">{h}</th>)}</tr></thead>
          <tbody>
            {list.map((o) => (
              <tr key={o.id} data-testid={`admin-order-${o.order_number}`} onClick={() => setSel(o)} className="border-t border-[#27272A]/60 hover:bg-[#18181B] cursor-pointer">
                <td className="p-3 font-mono text-white">{o.order_number}</td>
                <td className="p-3 text-zinc-300">{o.customer.first_name} {o.customer.last_name}</td>
                <td className="p-3 font-mono">{o.items.length}</td>
                <td className="p-3 font-mono text-white">{formatARS(o.total)}</td>
                <td className="p-3 font-mono text-xs text-zinc-400">{o.payment_method}</td>
                <td className="p-3"><span className="font-mono text-[10px] uppercase bg-[#E60023]/10 text-[#E60023] px-2 py-0.5">{o.status}</span></td>
                <td className="p-3 font-mono text-xs text-zinc-500">{new Date(o.created_at).toLocaleDateString("es-AR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sel && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 overflow-y-auto" onClick={() => setSel(null)}>
          <div onClick={e => e.stopPropagation()} className="min-h-screen flex items-start justify-center p-4">
            <div className="w-full max-w-2xl bg-[#121215] border border-[#27272A] p-6 my-10">
              <h2 className="font-heading text-2xl uppercase font-bold text-white">Pedido {sel.order_number}</h2>
              <p className="font-mono text-xs text-zinc-500 mt-1">{new Date(sel.created_at).toLocaleString("es-AR")}</p>
              <div className="mt-4 border-y border-[#27272A] py-4 text-sm text-zinc-300 space-y-1">
                <p><span className="text-zinc-500">Cliente:</span> {sel.customer.first_name} {sel.customer.last_name}</p>
                <p><span className="text-zinc-500">Email:</span> {sel.customer.email}</p>
                <p><span className="text-zinc-500">Teléfono:</span> {sel.customer.phone}</p>
                <p><span className="text-zinc-500">Pago:</span> {sel.payment_method}</p>
                <p><span className="text-zinc-500">Entrega:</span> {sel.delivery_method}</p>
              </div>
              <div className="mt-4 space-y-2">
                {sel.items.map((it, i) => (
                  <div key={i} className="flex justify-between text-sm text-zinc-300">
                    <span>{it.quantity}× {it.name} {it.variant_color && `(${it.variant_color}${it.variant_size ? `/${it.variant_size}` : ""})`}</span>
                    <span className="font-mono">{formatARS(it.final_price * it.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 border-t border-[#27272A] pt-4 text-right">
                <p className="font-mono font-bold text-white text-xl">{formatARS(sel.total)}</p>
                <p className="font-mono text-xs text-zinc-500">+{sel.points_earned} puntos</p>
              </div>
              <div className="mt-6">
                <h4 className="font-mono text-xs uppercase tracking-widest text-zinc-500 mb-3">Cambiar estado</h4>
                <div className="flex flex-wrap gap-2">
                  {STATUSES.map((s) => (
                    <button key={s} onClick={() => update(sel, s)} data-testid={`status-${s}`} className={`px-3 py-2 font-mono text-xs uppercase tracking-wider border ${sel.status === s ? "border-[#E60023] bg-[#E60023] text-white" : "border-[#27272A] text-zinc-400 hover:border-white"}`}>{s}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
