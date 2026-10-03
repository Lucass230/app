import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { formatErr } from "@/lib/api";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const u = await login(email, password);
      toast.success("Bienvenido");
      nav(u.role === "admin" ? "/admin" : "/cuenta");
    } catch (e) { toast.error(formatErr(e)); } finally { setLoading(false); }
  };

  return (
    <div className="max-w-md mx-auto px-6 py-16 animate-fade-up">
      <h1 className="font-heading text-4xl uppercase font-extrabold tracking-tighter text-white">Ingresar</h1>
      <p className="font-mono text-xs uppercase tracking-widest text-zinc-500 mt-2">Accedé a tu cuenta CATTO</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <input data-testid="login-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full bg-[#1C1C20] border border-[#27272A] focus:border-[#E60023] text-white text-sm px-4 py-3 outline-none" />
        <input data-testid="login-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" className="w-full bg-[#1C1C20] border border-[#27272A] focus:border-[#E60023] text-white text-sm px-4 py-3 outline-none" />
        <button type="submit" disabled={loading} data-testid="login-submit" className="w-full bg-[#E60023] hover:bg-[#FF1E27] text-white font-body font-bold text-sm uppercase tracking-wider py-4 shadow-[0_0_20px_rgba(230,0,35,0.3)]">
          {loading ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
      <p className="mt-6 text-sm text-zinc-400">¿No tenés cuenta? <Link to="/registro" data-testid="go-register" className="text-[#E60023] hover:underline">Crear cuenta</Link></p>
    </div>
  );
}
