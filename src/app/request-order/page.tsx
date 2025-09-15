"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/contexts/cart-data";

const GH_PHONE = /^(\+233\d{9}|0\d{9})$/; // +233XXXXXXXXX or 0XXXXXXXXX
const isNonEmpty = (s: string) => s.trim().length > 1;

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
  const [form, setForm] = useState({ phone: "", city: "", address: "", deliveryPay: "before" as "before" | "after" });

  const [touched, setTouched] = useState({ phone: false, city: false, address: false, deliveryPay: false });
  const errors = {
    phone: !GH_PHONE.test(form.phone.trim()) ? "Enter a valid Ghana phone (e.g. +233 55 123 4567 or 0551234567)" : null,
    city: !isNonEmpty(form.city) ? "City is required" : null,
    address: !isNonEmpty(form.address) ? "Address is required" : null,
    deliveryPay: form.deliveryPay !== "before" && form.deliveryPay !== "after" ? "Select an option" : null,
  } as const;
  const isValid = !errors.phone && !errors.city && !errors.address && !errors.deliveryPay;

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
      } catch (e: unknown) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load cart");
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
    // client-side validate
    setTouched({ phone: true, city: true, address: true, deliveryPay: true });
    if (!isValid) {
      setSaving(false);
      return;
    }
    try {
      // Ensure signed in
      const me = await fetch("/api/auth/me", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      if (!me.ok) throw new Error("Please sign in to continue to checkout.");

      // Create order with phone/city/address and get Paystack URL
      const res = await fetch("/api/checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: form.phone, city: form.city, address: form.address, deliveryPayment: form.deliveryPay }),
      });
      const body = await res.json();
      if (!res.ok || !body?.url) {
        throw new Error(body?.error || "Failed to start checkout");
      }

      // Redirect to Paystack hosted checkout
      window.location.href = body.url as string;
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to start checkout");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white">
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-semibold text-gray-900">Request Order</h1>
        <p className="mt-2 text-gray-600">
          Enter your contact details to continue. On the next step, you’ll pay securely via Paystack (Mobile Money or Card).
        </p>

        {/* Phone + City + Address */}
        <div className="mt-6 grid gap-2">
          <label className="text-sm text-gray-700">Phone</label>
          <input
            required
            className={`rounded-lg border px-3 py-2 text-gray-700 ${errors.phone && touched.phone ? 'border-red-500' : 'border-gray-300'}`}
            value={form.phone}
            onBlur={() => setTouched(v => ({ ...v, phone: true }))}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+233 55 123 4567 or 0551234567"
          />
          {errors.phone && touched.phone && (
            <p className="text-xs text-red-600 mt-1">{errors.phone}</p>
          )}
        </div>
        <div className="grid gap-2">
          <label className="text-sm text-gray-700">City</label>
          <input
            required
            className={`rounded-lg border px-3 py-2 text-gray-700 ${errors.city && touched.city ? 'border-red-500' : 'border-gray-300'}`}
            value={form.city}
            onBlur={() => setTouched(v => ({ ...v, city: true }))}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            placeholder="Accra"
          />
          {errors.city && touched.city && (
            <p className="text-xs text-red-600 mt-1">{errors.city}</p>
          )}
        </div>
        <div className="grid gap-2">
          <label className="text-sm text-gray-700">Address</label>
          <textarea
            required
            rows={3}
            className={`rounded-lg border px-3 py-2 text-gray-700 ${errors.address && touched.address ? 'border-red-500' : 'border-gray-300'}`}
            value={form.address}
            onBlur={() => setTouched(v => ({ ...v, address: true }))}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="House number / Street, Area, Landmark"
          />
          {errors.address && touched.address && (
            <p className="text-xs text-red-600 mt-1">{errors.address}</p>
          )}
        </div>

        {/* Delivery payment preference */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700">Delivery payment</label>
          <p className="text-xs text-gray-500 mb-2">Choose how you want to pay the delivery fee.</p>
          <div className="flex gap-4">
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="deliveryPay"
                value="before"
                checked={form.deliveryPay === "before"}
                onChange={() => setForm({ ...form, deliveryPay: "before" })}
                onBlur={() => setTouched(v => ({ ...v, deliveryPay: true }))}
                className="h-4 w-4"
              />
              <span className="text-sm text-gray-800">Before delivery</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="deliveryPay"
                value="after"
                checked={form.deliveryPay === "after"}
                onChange={() => setForm({ ...form, deliveryPay: "after" })}
                onBlur={() => setTouched(v => ({ ...v, deliveryPay: true }))}
                className="h-4 w-4"
              />
              <span className="text-sm text-gray-800">After delivery</span>
            </label>
          </div>
          {errors.deliveryPay && touched.deliveryPay && (
            <p className="text-xs text-red-600 mt-1">{errors.deliveryPay}</p>
          )}
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
            disabled={saving || items.length === 0 || !isValid}
            className={`rounded-xl px-5 py-3 ${
              items.length === 0 || !isValid
                ? "cursor-not-allowed bg-gray-300 text-gray-500"
                : "bg-black text-white"
            } disabled:opacity-50`}
          >
            {saving ? "Redirecting…" : "Pay with Paystack"}
          </button>
        </form>
      </main>
    </div>
  );
}