import React, { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api, { formatErr } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function AuthCallback() {
  const location = useLocation();
  const nav = useNavigate();
  const { setUser } = useAuth();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;
    const hash = location.hash || "";
    const match = hash.match(/session_id=([^&]+)/);
    if (!match) { nav("/login"); return; }
    const session_id = decodeURIComponent(match[1]);
    (async () => {
      try {
        const { data } = await api.post("/auth/google/session", { session_id });
        localStorage.setItem("catto_token", data.token);
        setUser(data.user);
        window.history.replaceState({}, "", "/");
        toast.success(`Bienvenido, ${data.user.first_name}`);
        nav(data.user.role === "admin" ? "/admin" : "/cuenta", { replace: true });
      } catch (e) {
        toast.error(formatErr(e));
        nav("/login", { replace: true });
      }
    })();
  }, [location.hash, nav, setUser]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <div className="font-heading text-3xl text-white uppercase tracking-tight">Validando sesión Google...</div>
        <p className="mt-2 font-mono text-xs uppercase tracking-widest text-zinc-500">Un momento</p>
      </div>
    </div>
  );
}
