import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, X, Upload } from "lucide-react";
import api, { formatARS, formatErr } from "@/lib/api";

const emptyProduct = {
  name: "", short_description: "", description: "", category_id: "", brand: "", sku: "",
  main_image: "", images: [], price: 0, discount_percent: 0, stock: 0,
  attributes: {}, variants: [], is_featured: false, is_new: false, is_on_sale: false,
  active: true, tags: [],
};

export default function AdminProducts() {
  const [list, setList] = useState([]);
  const [cats, setCats] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyProduct);
  const [editing, setEditing] = useState(null);
  const [uploading, setUploading] = useState(false);

  const load = () => api.get("/admin/products").then(({ data }) => setList(data));

  useEffect(() => {
    load();
    api.get("/categories").then(({ data }) => setCats(data));
  }, []);

  const openNew = () => { setForm(emptyProduct); setEditing(null); setOpen(true); };
  const openEdit = (p) => { setForm({ ...emptyProduct, ...p }); setEditing(p.id); setOpen(true); };

  const save = async () => {
    try {
      const payload = { ...form, price: Number(form.price), discount_percent: Number(form.discount_percent), stock: Number(form.stock) };
      if (!payload.category_id) { toast.error("Seleccioná una categoría"); return; }
      if (editing) await api.put(`/admin/products/${editing}`, payload);
      else await api.post("/admin/products", payload);
      toast.success("Producto guardado");
      setOpen(false);
      load();
    } catch (e) { toast.error(formatErr(e)); }
  };

  const del = async (p) => {
    if (!window.confirm(`¿Eliminar "${p.name}"?`)) return;
    await api.delete(`/admin/products/${p.id}`);
    toast.success("Eliminado");
    load();
  };

  const upload = async (e, isMain = true) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      const url = `${process.env.REACT_APP_BACKEND_URL}${data.url}`;
      if (isMain) setForm({ ...form, main_image: url, images: [url, ...(form.images || []).filter(i => i !== url)] });
      else setForm({ ...form, images: [...(form.images || []), url] });
      toast.success("Imagen subida");
    } catch (err) { toast.error(formatErr(err)); } finally { setUploading(false); }
  };

  const addVariant = () => setForm({ ...form, variants: [...(form.variants || []), { color: "", size: "", stock: 0 }] });
  const updVariant = (i, key, val) => {
    const v = [...form.variants];
    v[i] = { ...v[i], [key]: key === "stock" ? Number(val) : val };
    setForm({ ...form, variants: v });
  };
  const delVariant = (i) => setForm({ ...form, variants: form.variants.filter((_, idx) => idx !== i) });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-heading text-4xl uppercase font-extrabold tracking-tighter text-white">Productos</h1>
        <button onClick={openNew} data-testid="new-product-btn" className="bg-[#E60023] text-white font-body font-bold text-xs uppercase tracking-wider px-5 py-3 flex items-center gap-2"><Plus size={14} /> Nuevo</button>
      </div>

      <div className="border border-[#27272A] overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#18181B]">
            <tr className="text-left">
              {["Imagen", "Nombre", "Categoría", "Precio", "Stock", "Estado", "Acciones"].map(h => <th key={h} className="font-mono text-[10px] uppercase tracking-widest text-zinc-400 p-3">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className="border-t border-[#27272A]/60">
                <td className="p-3">{p.main_image ? <img src={p.main_image} alt="" className="w-12 h-12 object-cover" /> : "-"}</td>
                <td className="p-3 text-white">{p.name}</td>
                <td className="p-3 text-zinc-400 font-mono text-xs">{cats.find(c => c.id === p.category_id)?.name || "-"}</td>
                <td className="p-3 font-mono text-white">{formatARS(p.final_price)}</td>
                <td className="p-3 font-mono">{p.stock}</td>
                <td className="p-3"><span className={`font-mono text-[10px] uppercase ${p.active ? "text-[#10B981]" : "text-zinc-500"}`}>{p.active ? "Activo" : "Inactivo"}</span></td>
                <td className="p-3 flex gap-2">
                  <button onClick={() => openEdit(p)} data-testid={`edit-${p.id}`} className="p-2 text-zinc-400 hover:text-white"><Edit2 size={14} /></button>
                  <button onClick={() => del(p)} data-testid={`del-${p.id}`} className="p-2 text-zinc-400 hover:text-[#E60023]"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 overflow-y-auto">
          <div className="min-h-screen flex items-start justify-center p-4">
            <div className="w-full max-w-3xl bg-[#121215] border border-[#27272A] p-6 my-10">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-heading text-2xl uppercase font-bold text-white">{editing ? "Editar" : "Nuevo"} producto</h2>
                <button onClick={() => setOpen(false)}><X className="text-zinc-400" /></button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Nombre"><input data-testid="prod-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input" /></Field>
                  <Field label="Marca"><input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} className="input" /></Field>
                </div>
                <Field label="Descripción corta"><input value={form.short_description} onChange={e => setForm({ ...form, short_description: e.target.value })} className="input" /></Field>
                <Field label="Descripción"><textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="input" /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Categoría">
                    <select data-testid="prod-cat" value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })} className="input">
                      <option value="">Elegir...</option>
                      {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </Field>
                  <Field label="SKU"><input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} className="input" /></Field>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Precio (ARS)"><input data-testid="prod-price" type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className="input" /></Field>
                  <Field label="Descuento (%)"><input type="number" min="0" max="100" value={form.discount_percent} onChange={e => setForm({ ...form, discount_percent: e.target.value })} className="input" /></Field>
                  <Field label="Stock"><input type="number" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} className="input" /></Field>
                </div>
                <Field label="Imagen principal (URL)">
                  <div className="flex gap-2">
                    <input value={form.main_image} onChange={e => setForm({ ...form, main_image: e.target.value })} className="input" placeholder="https://..." />
                    <label className="bg-[#18181B] border border-[#27272A] text-white px-4 py-3 flex items-center gap-2 cursor-pointer text-xs uppercase font-mono">
                      <Upload size={14} /> {uploading ? "..." : "Subir"}
                      <input type="file" accept="image/*" onChange={(e) => upload(e, true)} className="hidden" />
                    </label>
                  </div>
                  {form.main_image && <img src={form.main_image} alt="" className="mt-2 w-32 h-32 object-cover border border-[#27272A]" />}
                </Field>

                <div className="flex gap-4 flex-wrap">
                  {[["is_featured", "Destacado"], ["is_new", "Nuevo"], ["is_on_sale", "En oferta"], ["active", "Activo"]].map(([k, l]) => (
                    <label key={k} className="flex items-center gap-2 text-sm text-zinc-300">
                      <input type="checkbox" checked={form[k]} onChange={e => setForm({ ...form, [k]: e.target.checked })} className="accent-[#E60023]" /> {l}
                    </label>
                  ))}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-mono text-xs uppercase tracking-widest text-zinc-500">Variantes (Color / Talle / Stock)</h4>
                    <button onClick={addVariant} data-testid="add-variant" className="font-mono text-xs text-[#E60023]">+ Agregar</button>
                  </div>
                  <div className="space-y-2">
                    {form.variants.map((v, i) => (
                      <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                        <input placeholder="Color" value={v.color || ""} onChange={e => updVariant(i, "color", e.target.value)} className="input" />
                        <input placeholder="Talle" value={v.size || ""} onChange={e => updVariant(i, "size", e.target.value)} className="input" />
                        <input placeholder="Stock" type="number" value={v.stock} onChange={e => updVariant(i, "stock", e.target.value)} className="input" />
                        <button onClick={() => delVariant(i)} className="p-2 text-zinc-500 hover:text-[#E60023]"><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={save} data-testid="save-product-btn" className="flex-1 bg-[#E60023] text-white font-body font-bold text-sm uppercase tracking-wider py-3">Guardar</button>
                <button onClick={() => setOpen(false)} className="bg-[#18181B] border border-[#27272A] text-white font-body font-bold text-sm uppercase tracking-wider py-3 px-6">Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <style>{`.input{width:100%;background:#1C1C20;border:1px solid #27272A;color:#fff;font-size:14px;padding:10px 14px;outline:none;}.input:focus{border-color:#E60023;}`}</style>
    </div>
  );
}

function Field({ label, children }) {
  return <label className="block"><span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">{label}</span>{children}</label>;
}
