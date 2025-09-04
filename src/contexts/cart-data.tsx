"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import type { CartLine } from "@/types/product";
import { createClientBrowser } from "@/lib/supabase/client";

type CartData = {
  lines: CartLine[];
  add: (productId: string, qty?: number) => Promise<void>;
  remove: (productId: string) => Promise<void>;
  setQty: (productId: string, qty: number) => Promise<void>;
  totalQty: number;
  userId: string | null;
  clear: () => void;
};

const Ctx = createContext<CartData>({
  lines: [],
  add: async () => {},
  remove: async () => {},
  setQty: async () => {},
  totalQty: 0,
  userId: null,
  clear: () => {},
});

export function CartDataProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClientBrowser(), []);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  // Track auth (seed + subscribe)
  useEffect(() => {
    let alive = true;

    (async () => {
      const { data: { user } } =
        (await supabase.auth.getUser().catch(() => ({ data: { user: null } }))) as any;
      if (!alive) return;
      setUserId(user?.id ?? null);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => {
      sub.subscription.unsubscribe();
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // don't re-run due to supabase fn identity

  // Load server cart whenever auth changes
  useEffect(() => {
    let alive = true;

    (async () => {
      if (!userId) {
        // signed out → empty local view
        if (alive) setLines([]);
        return;
      }

      const res = await fetch("/api/cart", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      }).catch(() => null);
      const body = await res?.json().catch(() => null);
      if (!alive) return;

      if (body?.ok && Array.isArray(body.lines)) {
        setLines(
          body.lines.map((r: any) => ({
            productId: r.product_id as string,
            quantity: Number(r.quantity ?? 0),
          }))
        );
      } else {
        setLines([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId]);

  const clear = useCallback(() => {
    // Client-only reset (server is cleared by /api/order-request after email send)
    setLines([]);
  }, []);

  // Server-only cart mutations (require sign-in)
  async function add(productId: string, qty = 1) {
    if (!userId) return; // UI should route to sign-in before calling
    const res = await fetch("/api/cart/add", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, quantity: qty }),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (body?.ok) {
      const q = Number(body.quantity ?? 0);
      setLines((prev) => {
        if (q <= 0) return prev.filter((l) => l.productId === productId ? false : true);
        const idx = prev.findIndex((l) => l.productId === productId);
        if (idx === -1) return [...prev, { productId, quantity: q }];
        const next = prev.slice();
        next[idx] = { ...next[idx], quantity: q };
        return next;
      });
    }
  }

  async function remove(productId: string) {
    if (!userId) return;
    const prev = lines;
    setLines((p) => p.filter((l) => l.productId !== productId)); // optimistic
    const ok = await fetch(`/api/cart/remove/${productId}`, {
      method: "DELETE",
      credentials: "include",
    })
      .then((r) => r.ok)
      .catch(() => false);
    if (!ok) setLines(prev); // rollback on failure
  }

  async function setQty(productId: string, qty: number) {
    if (!userId) return;
    const res = await fetch("/api/cart/set", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, quantity: qty }),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (body?.ok) {
      const q = Number(body.quantity ?? 0);
      setLines((prev) => {
        if (q <= 0) return prev.filter((l) => l.productId !== productId);
        const idx = prev.findIndex((l) => l.productId === productId);
        if (idx === -1) return [...prev, { productId, quantity: q }];
        const next = prev.slice();
        next[idx] = { ...next[idx], quantity: q };
        return next;
      });
    }
  }

  const totalQty = useMemo(
    () => lines.reduce((sum, l) => sum + l.quantity, 0),
    [lines]
  );

  return (
    <Ctx.Provider
      value={{ lines, add, remove, setQty, totalQty, userId, clear }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useCart() {
  return useContext(Ctx);
}