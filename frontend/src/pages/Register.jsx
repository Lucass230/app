import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { formatErr } from "@/lib/api";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ first_name: "", last_name: "", email: "", phone: "", address: "", password: "" });
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(f);
      toast.success("Cuenta creada");
      nav("/cuenta");
    } catch (e) { toast.error(formatErr(e)); } finally { setLoading(false); }
  };
  return (
    <div className="max-w-md mx-auto px-6 py-16 animate-fade-up">
      <h1 className="font-heading text-4xl uppercase font-extrabold tracking-tighter text-white">Crear cuenta</h1>
      <form onSubmit={submit} className="mt-8 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <input data-testid="reg-first" required placeholder="Nombre" value={f.first_name} onChange={set("first_name")} className="w-full bg-[#1C1C20] border border-[#27272A] text-white text-sm px-4 py-3 outline-none" />
          <input data-testid="reg-last" required placeholder="Apellido" value={f.last_name} onChange={set("last_name")} className="w-full bg-[#1C1C20] border border-[#27272A] text-white text-sm px-4 py-3 outline-none" />
        </div>
        <input data-testid="reg-email" type="email" required placeholder="Email" value={f.email} onChange={set("email")} className="w-full bg-[#1C1C20] border border-[#27272A] text-white text-sm px-4 py-3 outline-none" />
        <input data-testid="reg-phone" placeholder="Teléfono" value={f.phone} onChange={set("phone")} className="w-full bg-[#1C1C20] border border-[#27272A] text-white text-sm px-4 py-3 outline-none" />
        <input data-testid="reg-address" placeholder="Dirección (opcional)" value={f.address} onChange={set("address")} className="w-full bg-[#1C1C20] border border-[#27272A] text-white text-sm px-4 py-3 outline-none" />
        <input data-testid="reg-password" type="password" required minLength={6} placeholder="Contraseña (mín 6)" value={f.password} onChange={set("password")} className="w-full bg-[#1C1C20] border border-[#27272A] text-white text-sm px-4 py-3 outline-none" />
        <button type="submit" disabled={loading} data-testid="reg-submit" className="w-full bg-[#E60023] hover:bg-[#FF1E27] text-white font-body font-bold text-sm uppercase tracking-wider py-4 shadow-[0_0_20px_rgba(230,0,35,0.3)]">
          {loading ? "Creando..." : "Crear cuenta"}
        </button>
      </form>
      <p className="mt-6 text-sm text-zinc-400">¿Ya tenés cuenta? <Link to="/login" className="text-[#E60023] hover:underline">Ingresar</Link></p>
    </div>
  );
}
