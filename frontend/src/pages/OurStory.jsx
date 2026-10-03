import React, { useEffect, useState } from "react";
import api from "@/lib/api";

export default function OurStory() {
  const [s, setS] = useState({});
  useEffect(() => { api.get("/settings").then(({ data }) => setS(data)); }, []);
  return (
    <div className="max-w-4xl mx-auto px-6 lg:px-12 py-16 animate-fade-up">
      <span className="font-mono text-xs uppercase tracking-[0.3em] text-[#E60023]">Capítulo 01</span>
      <h1 className="mt-4 font-heading text-5xl sm:text-7xl uppercase font-extrabold tracking-tighter text-white leading-[0.9]">Nuestra historia</h1>
      <div className="mt-10 border-l-2 border-[#E60023] pl-6">
        <p className="font-body text-base sm:text-lg text-zinc-300 leading-relaxed whitespace-pre-line">
          {s.our_story || "Historia en construcción..."}
        </p>
      </div>
    </div>
  );
}
