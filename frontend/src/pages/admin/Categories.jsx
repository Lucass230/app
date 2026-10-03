import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Edit2 } from "lucide-react";
import api, { formatErr } from "@/lib/api";

export default function Categories() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ name: "", slug: "", description: "", image_url: "", active: true });
  const [editing, setEditing] = useState(null);

  const load = () => api.get("/admin/categories").then(({ data }) => setList(data));
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      if (!form.name || !form.slug) { toast.error("Nombre y slug requeridos"); return; }
      if (editing) await api.put(`/admin/categories/${editing}`, form);
      else await api.post("/admin/categories", form);
      toast.success("Categoría guardada");
      setForm({ name: "", slug: "", description: "", image_url: "", active: true });
      setEditing(null);
      load();
    } catch (e) { toast.error(formatErr(e)); }
  };

  const del = async (c) => {
    if (!window.confirm(`¿Eliminar "${c.name}"?`)) return;
    await api.delete(`/admin/categories/${c.id}`);
    load();
  };

  return (
    <div>
      <h1 className="font-heading uppercase font-extrabold tracking-tighter text-white mb-6 sm:mb-8 break-words" style={{ fontSize: "clamp(1.75rem, 7vw, 2.5rem)" }}>Categorías</h1>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
        <div className="border border-[#27272A]">
          <table className="w-full text-sm">
            <thead className="bg-[#18181B]"><tr>{["Nombre", "Slug", "Estado", ""].map(h => <th key={h} className="font-mono text-[10px] uppercase tracking-widest text-zinc-400 p-3 text-left">{h}</th>)}</tr></thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id} className="border-t border-[#27272A]/60">
                  <td className="p-3 text-white">{c.name}</td>
                  <td className="p-3 font-mono text-xs text-zinc-400">{c.slug}</td>
                  <td className="p-3"><span className={`font-mono text-[10px] uppercase ${c.active ? "text-[#10B981]" : "text-zinc-500"}`}>{c.active ? "Activo" : "Inactivo"}</span></td>
                  <td className="p-3 text-right flex gap-2 justify-end">
                    <button onClick={() => { setForm(c); setEditing(c.id); }} className="p-2 text-zinc-400 hover:text-white"><Edit2 size={14} /></button>
                    <button onClick={() => del(c)} className="p-2 text-zinc-400 hover:text-[#E60023]"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border border-[#27272A] p-5 bg-[#121215] space-y-3 h-fit">
          <h3 className="font-mono text-xs uppercase tracking-widest text-zinc-500">{editing ? "Editar" : "Nueva categoría"}</h3>
          <input placeholder="Nombre" value={form.name} onChange={e => setForm({ ...form, name: e.target.value, slug: form.slug || e.target.value.toLowerCase().replace(/\s+/g, "-") })} data-testid="cat-name" className="w-full bg-[#1C1C20] border border-[#27272A] text-white text-sm px-3 py-3 outline-none" />
          <input placeholder="Slug" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} className="w-full bg-[#1C1C20] border border-[#27272A] text-white text-sm px-3 py-3 outline-none" />
          <input placeholder="Imagen (URL)" value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} className="w-full bg-[#1C1C20] border border-[#27272A] text-white text-sm px-3 py-3 outline-none" />
          <textarea placeholder="Descripción" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full bg-[#1C1C20] border border-[#27272A] text-white text-sm px-3 py-3 outline-none" />
          <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} className="accent-[#E60023]" /> Activa</label>
          <button onClick={save} data-testid="save-cat-btn" className="w-full bg-[#E60023] text-white font-body font-bold text-xs uppercase tracking-wider py-3">{editing ? "Actualizar" : "Crear"}</button>
          {editing && <button onClick={() => { setEditing(null); setForm({ name: "", slug: "", description: "", image_url: "", active: true }); }} className="w-full border border-[#27272A] text-zinc-400 py-2 text-xs uppercase">Cancelar</button>}
        </div>
      </div>
    </div>
  );
}
