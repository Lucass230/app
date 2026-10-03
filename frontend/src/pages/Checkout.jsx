import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import api, { formatARS, formatErr } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";

export default function Checkout() {
  const { user, refresh } = useAuth();
  const { items, total, subtotal, discount, load } = useCart();
  const nav = useNavigate();
  const [settings, setSettings] = useState({});
  const [payment, setPayment] = useState("transferencia");
  const [delivery, setDelivery] = useState("punto_encuentro");
  const [address, setAddress] = useState("");
  const [redeem, setRedeem] = useState(0);
  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState(null); // {code, discount}
  const [couponLoading, setCouponLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) { nav("/login"); return; }
    api.get("/settings").then(({ data }) => setSettings(data));
  }, [user, nav]);

  const points = user?.points || 0;
  const points_rate = settings.points_redeem_rate || 10;
  const couponDiscount = couponApplied?.discount || 0;
  const afterCoupon = Math.max(0, total - couponDiscount);
  const redeemDiscount = Math.min(redeem * points_rate, afterCoupon);
  const finalTotal = Math.max(0, afterCoupon - redeemDiscount);

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    try {
      const { data } = await api.post("/coupons/validate", { code: couponCode.trim(), subtotal: total });
      setCouponApplied(data);
      toast.success(`Cupón ${data.code} aplicado`);
    } catch (e) {
      setCouponApplied(null);
      toast.error(formatErr(e));
    } finally { setCouponLoading(false); }
  };

  const removeCoupon = () => { setCouponApplied(null); setCouponCode(""); };

  const place = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/orders/checkout", {
        payment_method: payment,
        delivery_method: delivery,
        delivery_address: address,
        redeem_points: redeem,
        coupon_code: couponApplied?.code || null,
      });
      const o = data.order;
      await load();
      await refresh();

      // Build WhatsApp message
      const number = settings.whatsapp_number || "5493813007953";
      const lines = [
        "━━━━━━━━━━━━━━━━",
        "🛍️ CATTO — NUEVO PEDIDO",
        "━━━━━━━━━━━━━━━━",
        "",
        `📦 Pedido: ${o.order_number}`,
        "",
        "👤 CLIENTE",
        `Nombre: ${o.customer.first_name}`,
        `Apellido: ${o.customer.last_name}`,
        `Email: ${o.customer.email}`,
        `Teléfono: ${o.customer.phone || "-"}`,
        "",
        "🛒 PRODUCTOS",
        "",
        ...o.items.map((it, i) => {
          const vp = [];
          if (it.variant_color) vp.push(`Color: ${it.variant_color}`);
          if (it.variant_size) vp.push(`Talle: ${it.variant_size}`);
          return `${i+1}. ${it.name}\n   ${vp.join(" / ") || "-"}\n   Cantidad: ${it.quantity}\n   Precio: ${formatARS(it.final_price)}`;
        }),
        "",
        "━━━━━━━━━━━━━━━━",
        `Subtotal: ${formatARS(o.subtotal)}`,
        o.discount > 0 ? `Descuento: -${formatARS(o.discount)}` : null,
        o.coupon_code ? `Cupón ${o.coupon_code}: -${formatARS(o.coupon_discount)}` : null,
        o.redeem_discount > 0 ? `Puntos canjeados (${o.redeem_points}): -${formatARS(o.redeem_discount)}` : null,
        `TOTAL: ${formatARS(o.total)}`,
        "━━━━━━━━━━━━━━━━",
        "",
        `💳 Medio de pago: ${o.payment_method}`,
        `🚚 Entrega: ${o.delivery_method === "punto_encuentro" ? "Punto de encuentro" : "Uber (a cargo del cliente)"}`,
        o.delivery_address ? `📍 Dirección: ${o.delivery_address}` : null,
        "",
        `⭐ Puntos obtenidos: ${o.points_earned}`,
        "",
        "Gracias por comprar en CATTO.",
      ].filter(Boolean).join("\n");

      const url = `https://wa.me/${number}?text=${encodeURIComponent(lines)}`;
      toast.success(`Pedido ${o.order_number} creado. Abriendo WhatsApp...`);
      window.open(url, "_blank");
      setTimeout(() => nav("/cuenta"), 1500);
    } catch (e) {
      toast.error(formatErr(e));
    } finally {
      setLoading(false);
    }
  };

  if (!items.length) {
    return (
      <div className="max-w-xl mx-auto px-6 py-20 text-center">
        <h1 className="font-heading text-3xl uppercase text-white">Carrito vacío</h1>
        <Link to="/productos" className="inline-block mt-6 bg-[#E60023] text-white px-6 py-3 font-mono text-xs uppercase tracking-widest">Catálogo</Link>
      </div>
    );
  }

  const cardDisabled = !settings.card_payment_enabled;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-12 py-8 sm:py-10 animate-fade-up">
      <h1 className="font-heading font-extrabold uppercase tracking-tighter text-white mb-6 sm:mb-8 break-words" style={{ fontSize: "clamp(2rem, 10vw, 4rem)" }}>Checkout</h1>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 lg:gap-8">
        <div className="space-y-6 sm:space-y-8 min-w-0">
          <section>
            <h2 className="font-mono text-xs uppercase tracking-widest text-zinc-500 mb-4">Medio de pago</h2>
            <div className="space-y-2">
              {[
                { id: "transferencia", label: "Transferencia bancaria", note: "15% off aplicado por admin" },
                { id: "efectivo", label: "Efectivo", note: "" },
                { id: "tarjeta", label: "Pago con tarjeta — Próximamente", note: "Actualmente deshabilitado", disabled: cardDisabled },
              ].map((o) => (
                <label key={o.id} data-testid={`pay-${o.id}`} className={`flex items-start gap-3 border p-4 cursor-pointer transition ${payment === o.id ? "border-[#E60023] bg-[#E60023]/5" : "border-[#27272A]"} ${o.disabled ? "opacity-40 cursor-not-allowed" : ""}`}>
                  <input type="radio" disabled={o.disabled} name="pay" checked={payment === o.id} onChange={() => setPayment(o.id)} className="accent-[#E60023] mt-1" />
                  <div>
                    <p className="text-white text-sm font-medium">{o.label}</p>
                    {o.note && <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mt-1">{o.note}</p>}
                  </div>
                </label>
              ))}
            </div>
          </section>

          <section>
            <h2 className="font-mono text-xs uppercase tracking-widest text-zinc-500 mb-4">Entrega</h2>
            <div className="space-y-2">
              <label data-testid="del-punto" className={`flex items-center gap-3 border p-4 cursor-pointer ${delivery === "punto_encuentro" ? "border-[#E60023] bg-[#E60023]/5" : "border-[#27272A]"}`}>
                <input type="radio" name="del" checked={delivery === "punto_encuentro"} onChange={() => setDelivery("punto_encuentro")} className="accent-[#E60023]" />
                <div><p className="text-white text-sm">Punto de encuentro</p><p className="font-mono text-[10px] uppercase text-zinc-500">Sin costo</p></div>
              </label>
              <label data-testid="del-uber" className={`flex items-center gap-3 border p-4 cursor-pointer ${delivery === "uber" ? "border-[#E60023] bg-[#E60023]/5" : "border-[#27272A]"}`}>
                <input type="radio" name="del" checked={delivery === "uber"} onChange={() => setDelivery("uber")} className="accent-[#E60023]" />
                <div><p className="text-white text-sm">Uber / Delivery</p><p className="font-mono text-[10px] uppercase text-zinc-500">Costo a cargo del cliente</p></div>
              </label>
            </div>
            {delivery === "uber" && (
              <input value={address} onChange={(e) => setAddress(e.target.value)} data-testid="delivery-address" placeholder="Dirección de entrega" className="mt-3 w-full bg-[#1C1C20] border border-[#27272A] text-white text-sm px-4 py-3 outline-none" />
            )}
          </section>

          {points > 0 && (
            <section>
              <h2 className="font-mono text-xs uppercase tracking-widest text-zinc-500 mb-2">Canjear puntos (tenés {points})</h2>
              <p className="text-xs text-zinc-500 mb-3">1 punto = {formatARS(points_rate)} de descuento.</p>
              <input type="number" min="0" max={points} value={redeem} onChange={(e) => setRedeem(Math.max(0, Math.min(points, parseInt(e.target.value || 0))))} data-testid="redeem-points" className="w-full bg-[#1C1C20] border border-[#27272A] text-white text-sm px-4 py-3 outline-none" />
            </section>
          )}

          <section>
            <h2 className="font-mono text-xs uppercase tracking-widest text-zinc-500 mb-2">Cupón de descuento</h2>
            {couponApplied ? (
              <div className="flex items-center justify-between border border-[#E60023] bg-[#E60023]/5 px-4 py-3">
                <div>
                  <p className="font-mono text-sm font-bold text-white">{couponApplied.code}</p>
                  <p className="font-mono text-[10px] uppercase text-[#E60023]">-{formatARS(couponApplied.discount)} aplicado</p>
                </div>
                <button onClick={removeCoupon} data-testid="remove-coupon" className="font-mono text-xs text-zinc-400 hover:text-[#E60023] uppercase tracking-widest">Quitar</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} data-testid="coupon-input" placeholder="Ingresá tu código" className="flex-1 bg-[#1C1C20] border border-[#27272A] text-white text-sm px-4 py-3 outline-none uppercase tracking-wider" />
                <button onClick={applyCoupon} disabled={couponLoading || !couponCode.trim()} data-testid="apply-coupon-btn" className="bg-[#18181B] border border-[#27272A] hover:border-white text-white font-body font-bold text-xs uppercase tracking-widest px-5">
                  {couponLoading ? "..." : "Aplicar"}
                </button>
              </div>
            )}
          </section>
        </div>

        <aside className="h-fit border border-[#27272A] bg-[#121215] p-5 sm:p-6 lg:sticky lg:top-20">
          <h3 className="font-mono text-xs uppercase tracking-widest text-zinc-500 mb-5">Resumen</h3>
          <div className="space-y-3 text-sm">
            {items.map((it, i) => (
              <div key={i} className="flex justify-between text-zinc-400 gap-3">
                <span className="truncate">{it.quantity}× {it.product.name}</span>
                <span className="font-mono whitespace-nowrap shrink-0">{formatARS(it.product.final_price * it.quantity)}</span>
              </div>
            ))}
            <div className="border-t border-[#27272A] pt-3 flex justify-between text-zinc-300"><span>Subtotal</span><span className="font-mono whitespace-nowrap">{formatARS(subtotal)}</span></div>
            {discount > 0 && <div className="flex justify-between text-[#E60023]"><span>Descuento</span><span className="font-mono whitespace-nowrap">-{formatARS(discount)}</span></div>}
            {couponDiscount > 0 && <div className="flex justify-between text-[#E60023] gap-2"><span className="truncate">Cupón {couponApplied.code}</span><span className="font-mono whitespace-nowrap">-{formatARS(couponDiscount)}</span></div>}
            {redeemDiscount > 0 && <div className="flex justify-between text-[#E60023]"><span>Puntos</span><span className="font-mono whitespace-nowrap">-{formatARS(redeemDiscount)}</span></div>}
            <div className="border-t border-[#27272A] pt-3 flex justify-between font-bold text-white text-base sm:text-lg"><span>Total</span><span className="font-mono whitespace-nowrap">{formatARS(finalTotal)}</span></div>
          </div>
          <button onClick={place} disabled={loading} data-testid="place-order-btn" className="w-full mt-6 bg-[#E60023] hover:bg-[#FF1E27] disabled:bg-zinc-800 text-white font-body font-bold text-sm uppercase tracking-wider py-4 shadow-[0_0_20px_rgba(230,0,35,0.3)]">
            {loading ? "Procesando..." : "COMPRAR"}
          </button>
          <p className="mt-3 text-[10px] font-mono uppercase tracking-widest text-zinc-500 text-center">Al confirmar se abre WhatsApp con el pedido</p>
        </aside>
      </div>
    </div>
  );
}
