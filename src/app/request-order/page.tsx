"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/contexts/cart-data"; // ⬅️ make sure this path matches your project

export default function RequestOrderPage() {
  const r = useRouter();
  const { lines, userId } = useCart(); // ⬅️ get local cart + auth
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    phone: "",
    city: "",
  });

  // src/app/request-order/page.tsx

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    try {
      // 1) Check auth on the server (include cookies!)
      const me = await fetch("/api/auth/me", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      if (!me.ok) throw new Error("Please sign in before sending your order.");

      // 2) Merge local cart -> server cart (so the API can read it)
      if (lines?.length) {
        await fetch("/api/cart/merge", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lines }), // [{ productId, quantity }]
        });
      }

      // 3) Send the order email
      const res = await fetch("/api/order-request", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await res.json();
      if (!res.ok || !body?.ok)
        throw new Error(body?.error || "Failed to send request");

      r.replace("/request-order/sent");
    } catch (e: any) {
      setErr(e.message ?? "Failed to send request");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white min-h-[80vh]">
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-semibold text-gray-900">Request Order</h1>
        <p className="mt-2 text-gray-600">
          Send your cart to the store owner. They’ll contact you to arrange
          payment and delivery.
        </p>

        <div className="grid gap-2">
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

        <form onSubmit={submit} className="mt-6 grid gap-4">
          {/* ... your existing inputs ... */}
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-black px-5 py-3 text-white disabled:opacity-50"
          >
            {saving ? "Sending…" : "Send to store owner"}
          </button>
        </form>
      </main>
    </div>
  );
}
