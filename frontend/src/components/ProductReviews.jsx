import React, { useEffect, useState } from "react";
import { Star, X, Upload } from "lucide-react";
import { toast } from "sonner";
import api, { formatErr } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

function Stars({ value = 0, onChange, size = 16, interactive = false }) {
  const [hover, setHover] = useState(0);
  const render = interactive ? (hover || value) : value;
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!interactive}
          onMouseEnter={() => interactive && setHover(n)}
          onMouseLeave={() => interactive && setHover(0)}
          onClick={() => interactive && onChange?.(n)}
          data-testid={interactive ? `star-${n}` : undefined}
          className={interactive ? "cursor-pointer" : "cursor-default"}
        >
          <Star
            size={size}
            fill={n <= render ? "#E60023" : "transparent"}
            stroke={n <= render ? "#E60023" : "#52525B"}
            strokeWidth={1.5}
          />
        </button>
      ))}
    </div>
  );
}

export default function ProductReviews({ product }) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [eligible, setEligible] = useState(null); // {product_id, order_id, ...}
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = () => api.get(`/products/${product.id}/reviews`).then(({ data }) => setReviews(data));

  useEffect(() => {
    load();
    if (user) {
      api.get("/reviews/eligible").then(({ data }) => {
        setEligible(data.find((e) => e.product_id === product.id) || null);
      }).catch(() => {});
    }
  }, [product.id, user]);

  const upload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const { data } = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setImageUrl(`${process.env.REACT_APP_BACKEND_URL}${data.url}`);
      toast.success("Foto subida");
    } catch (err) { toast.error(formatErr(err)); } finally { setUploading(false); }
  };

  const submit = async () => {
    if (!eligible) return;
    setSubmitting(true);
    try {
      await api.post(`/products/${product.id}/reviews`, {
        rating, comment, image_url: imageUrl, order_id: eligible.order_id,
      });
      toast.success("¡Gracias por tu reseña!");
      setOpen(false); setRating(5); setComment(""); setImageUrl("");
      setEligible(null);
      load();
    } catch (e) { toast.error(formatErr(e)); } finally { setSubmitting(false); }
  };

  const avg = product.avg_rating || 0;
  const total = reviews.length;
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, c: reviews.filter(r => r.rating === n).length }));

  return (
    <section className="mt-12 sm:mt-16 border-t border-[#27272A] pt-10 sm:pt-12">
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6 sm:mb-8">
        <div className="min-w-0">
          <h2 className="font-heading font-extrabold uppercase tracking-tighter text-white break-words" style={{ fontSize: "clamp(1.75rem, 7vw, 2.5rem)" }}>Reseñas</h2>
          <div className="flex items-center gap-3 mt-2">
            <Stars value={Math.round(avg)} size={18} />
            <span className="font-mono text-sm text-white font-bold">{avg.toFixed(1)}</span>
            <span className="font-mono text-xs text-zinc-500 uppercase tracking-widest">({total})</span>
          </div>
        </div>
        {eligible && (
          <button onClick={() => setOpen(true)} data-testid="write-review-btn" className="bg-[#E60023] hover:bg-[#FF1E27] text-white font-body font-bold text-xs uppercase tracking-widest px-5 py-3 shadow-[0_0_15px_rgba(230,0,35,0.3)]">
            Dejar reseña
          </button>
        )}
      </div>

      {total > 0 && (
        <div className="mb-8 max-w-md space-y-1.5">
          {dist.map(({ n, c }) => (
            <div key={n} className="flex items-center gap-3">
              <span className="font-mono text-xs text-zinc-500 w-4">{n}★</span>
              <div className="flex-1 h-1.5 bg-[#27272A] overflow-hidden">
                <div className="h-full bg-[#E60023]" style={{ width: `${total ? (c / total * 100) : 0}%` }} />
              </div>
              <span className="font-mono text-xs text-zinc-500 w-6 text-right">{c}</span>
            </div>
          ))}
        </div>
      )}

      {reviews.length === 0 ? (
        <p className="text-zinc-500 text-sm">Este producto todavía no tiene reseñas. {eligible && "Sé el primero."}</p>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <div key={r.id} data-testid={`review-${r.id}`} className="border border-[#27272A] bg-[#121215] p-5">
              <div className="flex items-center justify-between gap-4 mb-2">
                <div className="flex items-center gap-3">
                  <Stars value={r.rating} size={14} />
                  <span className="font-body text-sm text-white font-medium">{r.user_name}</span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-[#E60023]">Compra verificada</span>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                  {new Date(r.created_at).toLocaleDateString("es-AR")}
                </span>
              </div>
              {r.comment && <p className="text-sm text-zinc-300 leading-relaxed">{r.comment}</p>}
              {r.image_url && <img src={r.image_url} alt="" className="mt-3 w-32 h-32 object-cover border border-[#27272A]" />}
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 overflow-y-auto" onClick={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()} className="min-h-screen flex items-start justify-center p-4">
            <div className="w-full max-w-lg bg-[#121215] border border-[#27272A] p-6 my-10">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-heading text-xl uppercase font-bold text-white">Tu reseña</h3>
                <button onClick={() => setOpen(false)}><X className="text-zinc-400" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 block mb-2">Puntuación</span>
                  <Stars value={rating} onChange={setRating} size={28} interactive />
                </div>
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 block mb-2">Comentario (opcional)</span>
                  <textarea rows={4} value={comment} onChange={e => setComment(e.target.value)} data-testid="review-comment" placeholder="Contanos cómo te resultó el producto..." className="w-full bg-[#1C1C20] border border-[#27272A] focus:border-[#E60023] text-white text-sm px-4 py-3 outline-none" />
                </div>
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 block mb-2">Foto (opcional)</span>
                  {imageUrl ? (
                    <div className="flex items-start gap-3">
                      <img src={imageUrl} alt="" className="w-24 h-24 object-cover border border-[#27272A]" />
                      <button onClick={() => setImageUrl("")} className="font-mono text-xs uppercase tracking-widest text-zinc-400 hover:text-[#E60023]">Quitar</button>
                    </div>
                  ) : (
                    <label className="inline-flex items-center gap-2 bg-[#18181B] border border-[#27272A] hover:border-white text-white px-4 py-3 cursor-pointer text-xs uppercase font-mono">
                      <Upload size={14} /> {uploading ? "Subiendo..." : "Subir foto"}
                      <input type="file" accept="image/*" onChange={upload} className="hidden" />
                    </label>
                  )}
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={submit} disabled={submitting} data-testid="submit-review-btn" className="flex-1 bg-[#E60023] hover:bg-[#FF1E27] text-white font-body font-bold text-sm uppercase tracking-wider py-3">
                    {submitting ? "Publicando..." : "Publicar reseña"}
                  </button>
                  <button onClick={() => setOpen(false)} className="bg-[#18181B] border border-[#27272A] text-white font-body font-bold text-sm uppercase tracking-wider py-3 px-6">Cancelar</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
