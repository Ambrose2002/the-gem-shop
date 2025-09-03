"use client";
import { createContext, useContext, useMemo, useState, useEffect, useRef } from "react";
import type { CartLine } from "@/types/product";
import { createClientBrowser } from "@/lib/supabase/client";

type CartData = {
  lines: CartLine[];
  add: (productId: string, qty?: number) => void;
  remove: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
  totalQty: number;
  subtotalCents: number;
};

const CartDataContext = createContext<CartData>({
  lines: [],
  add: () => {},
  remove: () => {},
  setQty: () => {},
  totalQty: 0,
  subtotalCents: 0,
});

export function CartDataProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const supabase = useMemo(() => createClientBrowser(), []);
  const mergedOnce = useRef(false);

  // Local helpers
  function add(productId: string, qty = 1) {
    setLines(prev => {
      const found = prev.find(l => l.productId === productId);
      if (found) {
        return prev.map(l =>
          l.productId === productId
            ? { ...l, quantity: Math.min(l.quantity + qty, 99) }
            : l
        );
      }
      return [...prev, { productId, quantity: qty }];
    });
  }
  function remove(productId: string) {
    setLines(prev => prev.filter(l => l.productId !== productId));
  }
  function setQty(productId: string, qty: number) {
    setLines(prev => prev.map(l => (l.productId === productId ? { ...l, quantity: qty } : l)));
  }

  const totalQty = useMemo(() => lines.reduce((s, l) => s + l.quantity, 0), [lines]);
  const subtotalCents = 0;

  // Merge guest cart -> server cart once user is signed in
  useEffect(() => {
    (async () => {
      if (mergedOnce.current) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      mergedOnce.current = true;

      // 1) find or create active cart
      let { data: cart } = await supabase
        .from("carts")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (!cart) {
        const { data: newCart, error: cErr } = await supabase
          .from("carts")
          .insert({ user_id: user.id, status: "active" })
          .select("id")
          .single();
        if (cErr) return; // silently skip on error
        cart = newCart;
      }

      // 2) upsert local lines into server cart
      const local = lines;
      if (local.length === 0) return;

      // Load existing items to combine quantities
      const { data: existingItems } = await supabase
        .from("cart_items")
        .select("id, product_id, quantity")
        .eq("cart_id", cart.id);

      const qtyByProduct = new Map<string, number>();
      (existingItems ?? []).forEach(it => qtyByProduct.set(it.product_id, it.quantity));
      local.forEach(l => qtyByProduct.set(l.productId, Math.min(99, (qtyByProduct.get(l.productId) ?? 0) + l.quantity)));

      // Clear existing items (simplest) and insert merged snapshot
      if (existingItems && existingItems.length) {
        await supabase.from("cart_items").delete().eq("cart_id", cart.id);
      }
      const rows = Array.from(qtyByProduct.entries()).map(([pid, q]) => ({
        cart_id: cart.id, product_id: pid, quantity: q,
      }));
      if (rows.length) await supabase.from("cart_items").insert(rows);
    })();
  }, [lines]);

  const value: CartData = { lines, add, remove, setQty, totalQty, subtotalCents };
  return <CartDataContext.Provider value={value}>{children}</CartDataContext.Provider>;
}

export function useCartData() {
  return useContext(CartDataContext);
}