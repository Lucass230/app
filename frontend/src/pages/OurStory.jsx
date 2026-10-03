import React, { useEffect, useState } from "react";
import api from "@/lib/api";

export default function OurStory() {
  const [s, setS] = useState({});
  useEffect(() => { api.get("/settings").then(({ data }) => setS(data)); }, []);
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-12 py-10 sm:py-16 animate-fade-up">
      <span className="font-mono text-[10px] sm:text-xs uppercase tracking-[0.3em] text-[#E60023]">Capítulo 01</span>
      <h1 className="mt-3 sm:mt-4 font-heading uppercase font-extrabold tracking-tighter text-white leading-[0.9] break-words" style={{ fontSize: "clamp(2.25rem, 11vw, 5rem)" }}>Nuestra historia</h1>
      <div className="mt-8 sm:mt-10 border-l-2 border-[#E60023] pl-4 sm:pl-6">
        <p className="font-body text-sm sm:text-base lg:text-lg text-zinc-300 leading-relaxed whitespace-pre-line break-words">
          {s.our_story || "Historia en construcción..."}
        </p>
      </div>
    </div>
  );
}
