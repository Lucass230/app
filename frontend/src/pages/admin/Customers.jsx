import React, { useEffect, useState } from "react";
import api from "@/lib/api";

export default function Customers() {
  const [list, setList] = useState([]);
  useEffect(() => { api.get("/admin/customers").then(({ data }) => setList(data)); }, []);
  return (
    <div>
      <h1 className="font-heading uppercase font-extrabold tracking-tighter text-white mb-6 sm:mb-8 break-words" style={{ fontSize: "clamp(1.75rem, 7vw, 2.5rem)" }}>Clientes</h1>
      <div className="border border-[#27272A] overflow-x-auto -mx-4 sm:mx-0">
        <table className="w-full text-sm min-w-[560px]">
          <thead className="bg-[#18181B]"><tr>{["Nombre", "Email", "Teléfono", "Puntos", "Alta"].map(h => <th key={h} className="font-mono text-[10px] uppercase tracking-widest text-zinc-400 p-3 text-left">{h}</th>)}</tr></thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.id} className="border-t border-[#27272A]/60">
                <td className="p-3 text-white">{u.first_name} {u.last_name}</td>
                <td className="p-3 text-zinc-300">{u.email}</td>
                <td className="p-3 font-mono text-xs text-zinc-400">{u.phone || "-"}</td>
                <td className="p-3 font-mono font-bold text-[#E60023]">{u.points || 0}</td>
                <td className="p-3 font-mono text-xs text-zinc-500">{new Date(u.created_at).toLocaleDateString("es-AR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
