import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, Upload } from "lucide-react";
import api, { formatErr } from "@/lib/api";

const empty = { title: "", subtitle: "", description: "", image_url: "", button_text: "", button_link: "", order: 0, active: true };

export default function Carousel() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [uploading, setUploading] = useState(false);

  const load = () => api.get("/admin/carousel").then(({ data }) => setList(data));
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      if (!form.title || !form.image_url) { toast.error("Título e imagen requeridos"); return; }
      if (editing) await api.put(`/admin/carousel/${editing}`, form);
      else await api.post("/admin/carousel", form);
      toast.success("Slide guardado");
      setForm(empty); setEditing(null);
      load();
    } catch (e) { toast.error(formatErr(e)); }
  };

  const del = async (s) => {
    if (!window.confirm(`¿Eliminar slide "${s.title}"?`)) return;
    await api.delete(`/admin/carousel/${s.id}`);
    load();
  };

  const upload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const { data } = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      const url = `${process.env.REACT_APP_BACKEND_URL}${data.url}`;
      setForm({ ...form, image_url: url });
      toast.success("Imagen subida");
    } catch (err) { toast.error(formatErr(err)); } finally { setUploading(false); }
  };

  return (
    <div>
      <h1 className="font-heading text-4xl uppercase font-extrabold tracking-tighter text-white mb-8">Carrusel</h1>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-8">
        <div className="space-y-3">
          {list.map((s) => (
            <div key={s.id} data-testid={`slide-${s.id}`} className="flex gap-4 border border-[#27272A] bg-[#121215] p-3">
              <img src={s.image_url} alt="" className="w-32 h-20 object-cover" />
              <div className="flex-1">
                <h3 className="font-body font-medium text-white">{s.title}</h3>
                <p className="font-mono text-[10px] uppercase text-zinc-500">{s.subtitle} · Orden: {s.order} · {s.active ? "Activo" : "Inactivo"}</p>
                <p className="text-xs text-zinc-400 mt-1">{s.description}</p>
              </div>
              <div className="flex flex-col gap-2">
                <button onClick={() => { setForm(s); setEditing(s.id); }} className="p-2 text-zinc-400 hover:text-white"><Edit2 size={14} /></button>
                <button onClick={() => del(s)} className="p-2 text-zinc-400 hover:text-[#E60023]"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
        <div className="border border-[#27272A] p-5 bg-[#121215] space-y-3 h-fit">
          <h3 className="font-mono text-xs uppercase tracking-widest text-zinc-500">{editing ? "Editar" : "Nuevo"} slide</h3>
          <input placeholder="Título" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} data-testid="slide-title" className="input" />
          <input placeholder="Subtítulo" value={form.subtitle} onChange={e => setForm({ ...form, subtitle: e.target.value })} className="input" />
          <textarea placeholder="Descripción" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="input" />
          <div className="flex gap-2">
            <input placeholder="URL Imagen" value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} className="input flex-1" />
            <label className="bg-[#18181B] border border-[#27272A] text-white px-3 py-3 flex items-center cursor-pointer text-xs">
              <Upload size={14} />
              <input type="file" accept="image/*" onChange={upload} className="hidden" />
            </label>
          </div>
          {form.image_url && <img src={form.image_url} alt="" className="w-full h-32 object-cover border border-[#27272A]" />}
          <input placeholder="Texto botón" value={form.button_text} onChange={e => setForm({ ...form, button_text: e.target.value })} className="input" />
          <input placeholder="Link botón" value={form.button_link} onChange={e => setForm({ ...form, button_link: e.target.value })} className="input" />
          <input placeholder="Orden" type="number" value={form.order} onChange={e => setForm({ ...form, order: parseInt(e.target.value || 0) })} className="input" />
          <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} className="accent-[#E60023]" /> Activo</label>
          <button onClick={save} data-testid="save-slide-btn" className="w-full bg-[#E60023] text-white font-body font-bold text-xs uppercase tracking-wider py-3">{editing ? "Actualizar" : "Crear"}</button>
          {editing && <button onClick={() => { setEditing(null); setForm(empty); }} className="w-full border border-[#27272A] text-zinc-400 py-2 text-xs uppercase">Cancelar</button>}
        </div>
      </div>
      <style>{`.input{width:100%;background:#1C1C20;border:1px solid #27272A;color:#fff;font-size:14px;padding:10px 14px;outline:none;}.input:focus{border-color:#E60023;}`}</style>
    </div>
  );
}
