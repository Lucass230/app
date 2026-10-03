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

  const loginGoogle = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/auth/callback";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="max-w-md mx-auto px-6 py-16 animate-fade-up">
      <h1 className="font-heading text-4xl uppercase font-extrabold tracking-tighter text-white">Ingresar</h1>
      <p className="font-mono text-xs uppercase tracking-widest text-zinc-500 mt-2">Accedé a tu cuenta CATTO</p>

      <button onClick={loginGoogle} data-testid="login-google-btn" className="mt-8 w-full bg-white hover:bg-zinc-100 text-black font-body font-bold text-sm uppercase tracking-wider py-4 flex items-center justify-center gap-3 transition">
        <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
        Continuar con Google
      </button>

      <div className="my-6 flex items-center gap-3">
        <span className="flex-1 h-px bg-[#27272A]"></span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">o con email</span>
        <span className="flex-1 h-px bg-[#27272A]"></span>
      </div>

      <form onSubmit={submit} className="space-y-4">
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
