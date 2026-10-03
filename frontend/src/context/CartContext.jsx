import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get("/cart");
      setItems(data.items || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async (product_id, quantity = 1, variant_color = null, variant_size = null) => {
    if (!user) throw new Error("Debés iniciar sesión");
    await api.post("/cart/add", { product_id, quantity, variant_color, variant_size });
    await load();
  };

  const update = async (product_id, quantity, variant_color = null, variant_size = null) => {
    await api.post("/cart/update", { product_id, quantity, variant_color, variant_size });
    await load();
  };

  const clear = async () => {
    await api.post("/cart/clear");
    setItems([]);
  };

  const count = items.reduce((s, i) => s + (i.quantity || 0), 0);
  const subtotal = items.reduce((s, i) => s + (i.product?.price || 0) * i.quantity, 0);
  const total = items.reduce((s, i) => s + (i.product?.final_price || i.product?.price || 0) * i.quantity, 0);
  const discount = subtotal - total;

  return (
    <CartContext.Provider value={{ items, count, subtotal, total, discount, add, update, clear, load, loading }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
