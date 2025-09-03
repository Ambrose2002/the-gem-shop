"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CartLine } from "@/types/product";
import { createClientBrowser } from "@/lib/supabase/client";

type CartData = {
  lines: CartLine[];
  add: (productId: string, qty?: number) => void;
  remove: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
  totalQty: number;
};

const Ctx = createContext<CartData>({
  lines: [],
  add: () => {},
  remove: () => {},
  setQty: () => {},
  totalQty: 0,
});

export function CartDataProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClientBrowser(), []);
  const [lines, setLines] = useState<CartLine[]>([]);
  const mergedOnce = useRef(false);
  const [userId, setUserId] = useState<string | null>(null);

  // auth listener: track user id
  useEffect(() => {
    let mounted = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
      if (!mounted) return;
      setUserId(user?.id ?? null);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
      setUserId(user?.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []); // no supabase dep

  // when user signs in first time -> merge guest lines, then load server cart
  useEffect(() => {
    (async () => {
      if (!userId) return; // not signed in
      if (!mergedOnce.current) {
        mergedOnce.current = true;
        if (lines.length) {
          await fetch("/api/cart/merge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lines }),
          }).catch(() => {});
        }
      }
      const res = await fetch("/api/cart", { method: "GET" }).catch(() => null);
      const body = await res?.json().catch(() => null);
      if (body?.ok && Array.isArray(body.lines)) {
        setLines(
          body.lines.map((r: any) => ({
            productId: r.product_id,
            quantity: r.quantity,
          }))
        );
      }
    })();
  }, [userId]); // re-run on auth change

  // local helpers with server sync if signed in
  async function add(productId: string, qty = 1) {
    if (userId) {
      // Call the server first so we get the clamped quantity
      const res = await fetch("/api/cart/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity: qty }),
      }).catch(() => null);

      const body = await res?.json().catch(() => null);

      if (body?.ok) {
        const q: number = Number(body.quantity ?? 0);
        setLines((prev) => {
          if (q <= 0) return prev.filter((l) => l.productId !== productId);
          const idx = prev.findIndex((l) => l.productId === productId);
          if (idx === -1) return [...prev, { productId, quantity: q }];
          const next = prev.slice();
          next[idx] = { ...next[idx], quantity: q };
          return next;
        });
      }
      return;
    }

    // Guest fallback (local only), keep your previous optimistic logic
    setLines((prev) => {
      const found = prev.find((l) => l.productId === productId);
      if (found) {
        return prev.map((l) =>
          l.productId === productId
            ? { ...l, quantity: Math.min(99, l.quantity + qty) }
            : l
        );
      }
      return [...prev, { productId, quantity: Math.min(99, qty) }];
    });
  }

  async function remove(productId: string) {
    setLines((prev) => prev.filter((l) => l.productId !== productId));
    if (userId) {
      await fetch(`/api/cart/remove/${productId}`, { method: "DELETE" }).catch(
        () => {}
      );
    }
  }

  async function setQty(productId: string, qty: number) {
    if (userId) {
      const res = await fetch("/api/cart/set", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity: qty }),
      }).catch(() => null);

      const body = await res?.json().catch(() => null);

      if (body?.ok) {
        const q: number = Number(body.quantity ?? 0);
        setLines((prev) => {
          if (q <= 0) return prev.filter((l) => l.productId !== productId);
          const idx = prev.findIndex((l) => l.productId === productId);
          if (idx === -1) return [...prev, { productId, quantity: q }];
          const next = prev.slice();
          next[idx] = { ...next[idx], quantity: q };
          return next;
        });
      }
      return;
    }

    // Guest fallback (local only)
    setLines((prev) => {
      if (qty <= 0) return prev.filter((l) => l.productId !== productId);
      const idx = prev.findIndex((l) => l.productId === productId);
      if (idx === -1)
        return [...prev, { productId, quantity: Math.min(99, qty) }];
      const next = prev.slice();
      next[idx] = { ...next[idx], quantity: Math.min(99, qty) };
      return next;
    });
  }

  const totalQty = useMemo(
    () => lines.reduce((s, l) => s + l.quantity, 0),
    [lines]
  );

  return (
    <Ctx.Provider value={{ lines, add, remove, setQty, totalQty }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCartData() {
  return useContext(Ctx);
}
