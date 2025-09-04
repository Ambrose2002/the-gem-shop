"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/contexts/cart-data";

function formatMoney(amountMinor: number) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
  }).format((amountMinor || 0) / 100);
}

type CartViewItem = {
  productId: string;
  title: string;
  price_cents: number;   // per-unit in pesewas
  quantity: number;
  line_total: number;    // price_cents * quantity
  image?: string | null;
};

export default function RequestOrderPage() {
  const r = useRouter();
  const { userId, clear } = useCart();
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({ phone: "", city: "" });

  const [items, setItems] = useState<CartViewItem[]>([]);
  const [loadingCart, setLoadingCart] = useState(false);
  const subtotal = useMemo(
    () => items.reduce((s, it) => s + it.line_total, 0),
    [items]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingCart(true);
      setErr(null);
      try {
        const me = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
        if (!me.ok) {
          if (!cancelled) setItems([]);
          return;
        }
        const res = await fetch("/api/cart/details", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
        const data = await res.json();
        if (!cancelled) {
          setItems(Array.isArray(data?.items) ? data.items : []);
        }
      } catch (e: any) {
        if (!cancelled) setErr(e.message ?? "Failed to load cart");
      } finally {
        if (!cancelled) setLoadingCart(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    try {
      const me = await fetch("/api/auth/me", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      if (!me.ok) throw new Error("Please sign in before sending your order.");

      const res = await fetch("/api/order-request", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await res.json();
      if (!res.ok || !body?.ok) throw new Error(body?.error || "Failed to send request");

      clear(); // instant UI reset; server also cleared items
      r.replace("/request-order/sent");
    } catch (e: any) {
      setErr(e.message ?? "Failed to send request");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white">
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-semibold text-gray-900">Request Order</h1>
        <p className="mt-2 text-gray-600">
          Send your cart to the store owner. They’ll contact you to arrange
          payment and delivery.
        </p>

        {/* Phone + City */}
        <div className="mt-6 grid gap-2">
          <label className="text-sm text-gray-700">Phone</label>
          <input
            required
            className="rounded-lg border border-gray-300 px-3 py-2 text-gray-700"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+233 55 123 4567"
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm text-gray-700">City</label>
          <input
            required
            className="rounded-lg border border-gray-300 px-3 py-2 text-gray-700"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            placeholder="Accra"
          />
        </div>

        {/* Cart Preview */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">Your cart</h2>

          {loadingCart ? (
            <p className="mt-2 text-sm text-gray-500">Loading cart…</p>
          ) : items.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">Your cart is empty.</p>
          ) : (
            <div className="mt-3 divide-y divide-gray-200 overflow-hidden rounded-xl border border-gray-200">
              {items.map((it) => (
                <div key={it.productId} className="flex items-center gap-3 p-3">
                  <div className="h-14 w-14 overflow-hidden rounded-md bg-gray-100">
                    {it.image ? (
                      <img
                        src={it.image}
                        alt={it.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-gray-500">
                        No image
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">
                      {it.title}
                    </div>
                    <div className="text-xs text-gray-500">
                      Qty: {it.quantity}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-gray-900">
                    {formatMoney(it.line_total)}
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between p-3">
                <span className="text-sm text-gray-600">Subtotal</span>
                <span className="text-base font-semibold text-gray-900">
                  {formatMoney(subtotal)}
                </span>
              </div>
            </div>
          )}
        </section>

        {/* Submit */}
        <form onSubmit={submit} className="mt-6 grid gap-4">
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button
            type="submit"
            disabled={saving || items.length === 0}
            className={`rounded-xl px-5 py-3 ${
              items.length === 0
                ? "cursor-not-allowed bg-gray-300 text-gray-500"
                : "bg-black text-white"
            } disabled:opacity-50`}
          >
            {saving ? "Sending…" : "Send to store owner"}
          </button>
        </form>
      </main>
    </div>
  );
}