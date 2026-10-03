import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2, Edit2, Copy, Dice6 } from "lucide-react";
import api, { formatARS, formatErr } from "@/lib/api";

const empty = { code: "", discount_percent: 0, discount_amount: 0, max_uses: 0, expires_at: "", active: true, description: "" };

const genCode = () => {
  const parts = ["CATTO", "VIP", "FLASH", "DROP", "URBAN", "RED"];
  const n = Math.floor(10 + Math.random() * 89);
  return parts[Math.floor(Math.random() * parts.length)] + n;
};

export default function Coupons() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);

  const load = () => api.get("/admin/coupons").then(({ data }) => setList(data));
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      if (!form.code) { toast.error("Código requerido"); return; }
      if (!form.discount_percent && !form.discount_amount) { toast.error("Agregá un % o un monto"); return; }
      const payload = {
        ...form,
        discount_percent: Number(form.discount_percent || 0),
        discount_amount: Number(form.discount_amount || 0),
        max_uses: Number(form.max_uses || 0),
        expires_at: form.expires_at || null,
      };
      if (editing) await api.put(`/admin/coupons/${editing}`, payload);
      else await api.post("/admin/coupons", payload);
      toast.success(editing ? "Cupón actualizado" : "Cupón creado");
      setForm(empty); setEditing(null);
      load();
    } catch (e) { toast.error(formatErr(e)); }
  };

  const del = async (c) => {
    if (!window.confirm(`¿Eliminar "${c.code}"?`)) return;
    await api.delete(`/admin/coupons/${c.id}`);
    load();
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    toast.success(`Código ${code} copiado`);
  };

  return (
    <div>
      <h1 className="font-heading text-4xl uppercase font-extrabold tracking-tighter text-white mb-2">Cupones</h1>
      <p className="font-mono text-xs uppercase tracking-widest text-zinc-500 mb-8">Códigos manuales para Instagram, campañas y clientes VIP</p>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-8">
        <div className="border border-[#27272A] overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#18181B]">
              <tr>{["Código", "Descuento", "Usos", "Expira", "Estado", ""].map(h => <th key={h} className="font-mono text-[10px] uppercase tracking-widest text-zinc-400 p-3 text-left">{h}</th>)}</tr>
            </thead>
            <tbody>
              {list.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-zinc-500 text-sm">Todavía no creaste cupones. Generá uno a la derecha.</td></tr>}
              {list.map((c) => (
                <tr key={c.id} data-testid={`coupon-row-${c.code}`} className="border-t border-[#27272A]/60">
                  <td className="p-3 font-mono text-white font-bold">
                    <button onClick={() => copyCode(c.code)} className="hover:text-[#E60023] flex items-center gap-2">
                      {c.code} <Copy size={12} />
                    </button>
                  </td>
                  <td className="p-3 text-zinc-300">{c.discount_percent ? `${c.discount_percent}%` : formatARS(c.discount_amount)}</td>
                  <td className="p-3 font-mono text-xs text-zinc-400">{c.uses || 0}{c.max_uses ? `/${c.max_uses}` : ""}</td>
                  <td className="p-3 font-mono text-xs text-zinc-400">{c.expires_at ? new Date(c.expires_at).toLocaleDateString("es-AR") : "—"}</td>
                  <td className="p-3"><span className={`font-mono text-[10px] uppercase ${c.active ? "text-[#10B981]" : "text-zinc-500"}`}>{c.active ? "Activo" : "Inactivo"}</span></td>
                  <td className="p-3 flex gap-2 justify-end">
                    <button onClick={() => { setForm({ ...c, expires_at: c.expires_at || "" }); setEditing(c.id); }} className="p-2 text-zinc-400 hover:text-white"><Edit2 size={14} /></button>
                    <button onClick={() => del(c)} className="p-2 text-zinc-400 hover:text-[#E60023]"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border border-[#27272A] p-5 bg-[#121215] space-y-3 h-fit">
          <h3 className="font-mono text-xs uppercase tracking-widest text-zinc-500">{editing ? "Editar" : "Nuevo"} cupón</h3>
          <div className="flex gap-2">
            <input placeholder="Código (ej: VIP20)" value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} data-testid="coupon-code" className="input flex-1" />
            <button onClick={() => setForm({ ...form, code: genCode() })} data-testid="gen-coupon-btn" className="bg-[#18181B] border border-[#27272A] text-white px-3 py-2 text-xs font-mono flex items-center gap-1" title="Generar código"><Dice6 size={14} /></button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">% Descuento</span><input type="number" min="0" max="100" value={form.discount_percent} onChange={e => setForm({ ...form, discount_percent: e.target.value, discount_amount: 0 })} className="input" /></label>
            <label className="block"><span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">O monto fijo</span><input type="number" min="0" value={form.discount_amount} onChange={e => setForm({ ...form, discount_amount: e.target.value, discount_percent: 0 })} className="input" /></label>
          </div>
          <label className="block"><span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">Usos máximos (0 = ilimitado)</span><input type="number" min="0" value={form.max_uses} onChange={e => setForm({ ...form, max_uses: e.target.value })} className="input" /></label>
          <label className="block"><span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">Expira (opcional)</span><input type="date" value={form.expires_at ? form.expires_at.slice(0, 10) : ""} onChange={e => setForm({ ...form, expires_at: e.target.value ? e.target.value + "T23:59:59Z" : "" })} className="input" /></label>
          <input placeholder="Descripción (interna)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="input" />
          <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} className="accent-[#E60023]" /> Activo</label>
          <button onClick={save} data-testid="save-coupon-btn" className="w-full bg-[#E60023] text-white font-body font-bold text-xs uppercase tracking-wider py-3">{editing ? "Actualizar" : "Crear cupón"}</button>
          {editing && <button onClick={() => { setEditing(null); setForm(empty); }} className="w-full border border-[#27272A] text-zinc-400 py-2 text-xs uppercase">Cancelar</button>}
        </div>
      </div>
      <style>{`.input{width:100%;background:#1C1C20;border:1px solid #27272A;color:#fff;font-size:14px;padding:10px 14px;outline:none;}.input:focus{border-color:#E60023;}`}</style>
    </div>
  );
}
