import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import api, { formatErr } from "@/lib/api";

export default function Settings() {
  const [s, setS] = useState({});
  useEffect(() => { api.get("/settings").then(({ data }) => setS(data)); }, []);
  const save = async () => {
    try {
      await api.put("/admin/settings", s);
      toast.success("Configuración guardada");
    } catch (e) { toast.error(formatErr(e)); }
  };
  const set = (k) => (e) => setS({ ...s, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.type === "number" ? parseFloat(e.target.value) : e.target.value });

  return (
    <div>
      <h1 className="font-heading text-4xl uppercase font-extrabold tracking-tighter text-white mb-8">Configuración</h1>
      <div className="max-w-3xl space-y-5">
        <Field label="Nombre de la tienda"><input value={s.store_name || ""} onChange={set("store_name")} className="input" /></Field>
        <Field label="WhatsApp (con prefijo, ej: 5493813007953)"><input value={s.whatsapp_number || ""} onChange={set("whatsapp_number")} data-testid="setting-wa" className="input" /></Field>
        <Field label="Descripción"><textarea rows={2} value={s.store_description || ""} onChange={set("store_description")} className="input" /></Field>
        <Field label="Nuestra historia"><textarea rows={6} value={s.our_story || ""} onChange={set("our_story")} className="input" /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Puntos por peso (ej: 0.001 = 1 pto / $1.000)"><input type="number" step="0.001" value={s.points_per_peso || 0} onChange={set("points_per_peso")} className="input" /></Field>
          <Field label="Pesos por punto al canjear (ej: 10)"><input type="number" value={s.points_redeem_rate || 0} onChange={set("points_redeem_rate")} className="input" /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input type="checkbox" checked={!!s.card_payment_enabled} onChange={set("card_payment_enabled")} data-testid="card-toggle" className="accent-[#E60023]" />
          Habilitar pago con tarjeta
        </label>
        <button onClick={save} data-testid="save-settings-btn" className="bg-[#E60023] text-white font-body font-bold text-sm uppercase tracking-wider px-8 py-3">Guardar</button>
      </div>
      <style>{`.input{width:100%;background:#1C1C20;border:1px solid #27272A;color:#fff;font-size:14px;padding:10px 14px;outline:none;}.input:focus{border-color:#E60023;}`}</style>
    </div>
  );
}

function Field({ label, children }) {
  return <label className="block"><span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">{label}</span>{children}</label>;
}
