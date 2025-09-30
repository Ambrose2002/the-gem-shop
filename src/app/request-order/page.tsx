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
  price_cents: number;
  quantity: number;
  line_total: number;
  image?: string | null;
};

type PackageOption = {
  id: string;
  title: string;
  description: string;
  price_cents: number;
  stock: number;
  images: string[];
};

type LineSelections = Record<string, number>;
type SelectedPackagesState = Record<string, LineSelections>;

export default function RequestOrderPage() {
  const router = useRouter();
  const { userId } = useCart();

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    phone: "",
    city: "",
    address: "",
    deliveryPay: "before" as "before" | "after",
  });

  const [touched, setTouched] = useState({
    phone: false,
    city: false,
    address: false,
    deliveryPay: false,
  });

  const validationErrors = {
    phone: !GH_PHONE.test(form.phone.trim())
      ? "Enter a valid Ghana phone (e.g. +233 55 123 4567 or 0551234567)"
      : null,
    city: !isNonEmpty(form.city) ? "City is required" : null,
    address: !isNonEmpty(form.address) ? "Address is required" : null,
    deliveryPay:
      form.deliveryPay !== "before" && form.deliveryPay !== "after"
        ? "Select an option"
        : null,
  } as const;
  const isValid =
    !validationErrors.phone &&
    !validationErrors.city &&
    !validationErrors.address &&
    !validationErrors.deliveryPay;

  const [items, setItems] = useState<CartViewItem[]>([]);
  const [loadingCart, setLoadingCart] = useState(false);

  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [packagesError, setPackagesError] = useState<string | null>(null);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [selectedPackages, setSelectedPackages] = useState<SelectedPackagesState>({});
  const [modalPackage, setModalPackage] = useState<PackageOption | null>(null);
  const [modalImageIndex, setModalImageIndex] = useState(0);

  const packagesMap = useMemo(() => {
    const map: Record<string, PackageOption> = {};
    packages.forEach((pkg) => {
      map[pkg.id] = pkg;
    });
    return map;
  }, [packages]);

  const subtotal = useMemo(
    () => items.reduce((sum, it) => sum + it.line_total, 0),
    [items]
  );

  const packagingTotal = useMemo(() => {
    return items.reduce((sum, item) => {
      const selections = selectedPackages[item.productId] ?? {};
      return (
        sum +
        Object.entries(selections).reduce((lineSum, [packageId, quantity]) => {
          const pkg = packagesMap[packageId];
          if (!pkg) return lineSum;
          return lineSum + quantity * pkg.price_cents;
        }, 0)
      );
    }, 0);
  }, [items, selectedPackages, packagesMap]);

  const grandTotal = subtotal + packagingTotal;

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
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "Failed to load cart");
        }
      } finally {
        if (!cancelled) setLoadingCart(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingPackages(true);
      setPackagesError(null);
      try {
        const res = await fetch("/api/packages", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
        const body = await res.json().catch(() => null);
        if (!alive) return;
        if (body?.ok && Array.isArray(body.packages)) {
          const filtered = body.packages.filter(
            (pkg: PackageOption) => Number(pkg.stock ?? 0) > 0
          );
          setPackages(filtered);
        } else if (body?.error) {
          setPackagesError(body.error);
        } else {
          setPackagesError("Failed to load packages");
        }
      } catch (e: unknown) {
        if (!alive) return;
        setPackagesError(
          e instanceof Error ? e.message : "Failed to load packages"
        );
      } finally {
        if (alive) setLoadingPackages(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    setSelectedPackages((prev) => {
      const next: SelectedPackagesState = {};
      items.forEach((item) => {
        const prevLine = prev[item.productId] ?? {};
        const cleaned: LineSelections = {};
        let remaining = item.quantity;
        Object.entries(prevLine).forEach(([packageId, quantity]) => {
          if (!packagesMap[packageId] || remaining <= 0) return;
          const safeQty = Math.min(quantity, remaining);
          if (safeQty > 0) {
            cleaned[packageId] = safeQty;
            remaining -= safeQty;
          }
        });
        if (Object.keys(cleaned).length) {
          next[item.productId] = cleaned;
        }
      });
      return next;
    });
  }, [items, packagesMap]);

  function totalSelectedForLine(productId: string) {
    const selections = selectedPackages[productId];
    if (!selections) return 0;
    return Object.values(selections).reduce((sum, qty) => sum + qty, 0);
  }

  function updatePackageQuantity(
    productId: string,
    packageId: string,
    nextQuantity: number
  ) {
    const line = items.find((it) => it.productId === productId);
    if (!line) return;
    const pkg = packagesMap[packageId];
    const stockCap = pkg ? Math.max(0, pkg.stock) : Number.POSITIVE_INFINITY;

    setSelectedPackages((prev) => {
      const lineSelections = { ...(prev[productId] ?? {}) } as LineSelections;
      const totalOther = Object.entries(lineSelections).reduce(
        (sum, [id, qty]) => (id === packageId ? sum : sum + qty),
        0
      );
      const capped = Math.max(
        0,
        Math.min(
          nextQuantity,
          Math.max(0, line.quantity - totalOther),
          stockCap
        )
      );

      if (capped <= 0) {
        delete lineSelections[packageId];
      } else {
        lineSelections[packageId] = capped;
      }

      const nextState: SelectedPackagesState = { ...prev };
      if (Object.keys(lineSelections).length) {
        nextState[productId] = lineSelections;
      } else {
        delete nextState[productId];
      }
      return nextState;
    });
  }

  function incrementPackage(productId: string, packageId: string) {
    const current = selectedPackages[productId]?.[packageId] ?? 0;
    updatePackageQuantity(productId, packageId, current + 1);
  }

  function decrementPackage(productId: string, packageId: string) {
    const current = selectedPackages[productId]?.[packageId] ?? 0;
    if (current <= 0) return;
    updatePackageQuantity(productId, packageId, current - 1);
  }

  function openPackageModal(pkg: PackageOption) {
    setModalPackage(pkg);
    setModalImageIndex(0);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    setTouched({ phone: true, city: true, address: true, deliveryPay: true });

    if (!isValid) {
      setSaving(false);
      return;
    }

    try {
      const me = await fetch("/api/auth/me", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      if (!me.ok) throw new Error("Please sign in to continue to checkout.");

      const packagesPayload = Object.entries(selectedPackages)
        .map(([productId, selectionMap]) => ({
          productId,
          selections: Object.entries(selectionMap)
            .map(([packageId, quantity]) => ({ packageId, quantity }))
            .filter((entry) => entry.quantity > 0),
        }))
        .filter((entry) => entry.selections.length);

      const res = await fetch("/api/checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: form.phone,
          city: form.city,
          address: form.address,
          deliveryPayment: form.deliveryPay,
          packages: packagesPayload,
        }),
      });
      const body = await res.json();
      if (!res.ok || !body?.url) {
        throw new Error(body?.error || "Failed to start checkout");
      }

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
          Enter your contact details to continue. On the next step, you’ll pay
          securely via Paystack (Mobile Money or Card).
        </p>

        <div className="mt-6 grid gap-2">
          <label className="text-sm text-gray-700">Phone</label>
          <input
            required
            className={`rounded-lg border px-3 py-2 text-gray-700 ${
              validationErrors.phone && touched.phone
                ? "border-red-500"
                : "border-gray-300"
            }`}
            value={form.phone}
            onBlur={() => setTouched((v) => ({ ...v, phone: true }))}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+233 55 123 4567 or 0551234567"
          />
          {validationErrors.phone && touched.phone && (
            <p className="mt-1 text-xs text-red-600">
              {validationErrors.phone}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <label className="text-sm text-gray-700">City</label>
          <input
            required
            className={`rounded-lg border px-3 py-2 text-gray-700 ${
              validationErrors.city && touched.city
                ? "border-red-500"
                : "border-gray-300"
            }`}
            value={form.city}
            onBlur={() => setTouched((v) => ({ ...v, city: true }))}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            placeholder="Accra"
          />
          {validationErrors.city && touched.city && (
            <p className="mt-1 text-xs text-red-600">{validationErrors.city}</p>
          )}
        </div>

        <div className="grid gap-2">
          <label className="text-sm text-gray-700">Address</label>
          <textarea
            required
            rows={3}
            className={`rounded-lg border px-3 py-2 text-gray-700 ${
              validationErrors.address && touched.address
                ? "border-red-500"
                : "border-gray-300"
            }`}
            value={form.address}
            onBlur={() => setTouched((v) => ({ ...v, address: true }))}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="House number / Street, Area, Landmark"
          />
          {validationErrors.address && touched.address && (
            <p className="mt-1 text-xs text-red-600">
              {validationErrors.address}
            </p>
          )}
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700">
            Delivery payment
          </label>
          <p className="mb-2 text-xs text-gray-500">
            Choose how you want to pay the delivery fee.
          </p>
          <div className="flex gap-4">
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="deliveryPay"
                value="before"
                checked={form.deliveryPay === "before"}
                onChange={() => setForm({ ...form, deliveryPay: "before" })}
                onBlur={() => setTouched((v) => ({ ...v, deliveryPay: true }))}
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
                onBlur={() => setTouched((v) => ({ ...v, deliveryPay: true }))}
                className="h-4 w-4"
              />
              <span className="text-sm text-gray-800">After delivery</span>
            </label>
          </div>
          {validationErrors.deliveryPay && touched.deliveryPay && (
            <p className="mt-1 text-xs text-red-600">
              {validationErrors.deliveryPay}
            </p>
          )}
        </div>

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">Your cart</h2>

          {loadingCart ? (
            <p className="mt-2 text-sm text-gray-500">Loading cart…</p>
          ) : items.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">Your cart is empty.</p>
          ) : (
            <div className="mt-3 divide-y divide-gray-200 overflow-hidden rounded-xl border border-gray-200">
              {items.map((it, idx) => {
                const selections = selectedPackages[it.productId] ?? {};
                const totalSelected = totalSelectedForLine(it.productId);

                return (
                  <div key={it.productId} className="p-3">
                    <div className="flex items-center gap-3">
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

                    <div className="mt-4 rounded-xl border border-gray-200 p-3">
                      <div className="flex items-center justify-between text-sm text-gray-700">
                        <span>Packaging (optional)</span>
                        <span className="text-xs text-gray-500">
                          {totalSelected}/{it.quantity} selected
                        </span>
                      </div>

                      {loadingPackages ? (
                        <p className="mt-3 text-xs text-gray-500">
                          Loading packages…
                        </p>
                      ) : packages.length === 0 ? (
                        <p className="mt-3 text-xs text-gray-500">
                          No packages available yet.
                        </p>
                      ) : (
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {packages.map((pkg) => {
                            const qtySelected = selections[pkg.id] ?? 0;
                            const canIncrement =
                              totalSelected < it.quantity &&
                              qtySelected < Math.max(0, pkg.stock);
                            const isOutOfStock = pkg.stock <= 0;

                            return (
                              <div
                                key={`${it.productId}-${pkg.id}`}
                                className={`rounded-2xl border p-3 transition ${
                                  qtySelected > 0
                                    ? "border-black ring-1 ring-black"
                                    : "border-gray-200 hover:border-gray-300"
                                }`}
                              >
                                <div className="h-24 w-full overflow-hidden rounded-lg bg-gray-100">
                                  {pkg.images[0] ? (
                                    <img
                                      src={pkg.images[0]}
                                      alt={pkg.title}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-xs text-gray-500">
                                      No image
                                    </div>
                                  )}
                                </div>
                                <div className="mt-3 flex items-start justify-between gap-2">
                                  <div>
                                    <div className="text-sm font-semibold text-gray-900">
                                      {pkg.title}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {formatMoney(pkg.price_cents)}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    className="text-xs text-gray-600 underline"
                                    onClick={() => openPackageModal(pkg)}
                                  >
                                    View
                                  </button>
                                </div>
                                <div className="mt-2 text-xs text-gray-500">
                                  {isOutOfStock
                                    ? "Out of stock"
                                    : `${pkg.stock} in stock`}
                                </div>
                                <div className="mt-3 flex items-center justify-between rounded-lg border border-gray-200 px-2 py-1 text-sm">
                                  <button
                                    type="button"
                                    onClick={() => decrementPackage(it.productId, pkg.id)}
                                    disabled={qtySelected === 0}
                                    className="h-7 w-7 rounded-md border border-gray-300 text-center text-base leading-6 disabled:opacity-40"
                                  >
                                    −
                                  </button>
                                  <span className="text-xs font-medium text-gray-700">
                                    {qtySelected}/{it.quantity}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => incrementPackage(it.productId, pkg.id)}
                                    disabled={!canIncrement || isOutOfStock}
                                    className="h-7 w-7 rounded-md border border-gray-300 text-center text-base leading-6 disabled:opacity-40"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {packagesError && idx === 0 && (
                        <p className="mt-3 text-xs text-red-600">{packagesError}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <form onSubmit={submit} className="mt-6 grid gap-4">
          {err && <p className="text-sm text-red-600">{err}</p>}

          <div className="rounded-xl border border-gray-200 p-4 text-sm text-gray-700">
            <div className="flex items-center justify-between">
              <span>Items subtotal</span>
              <span>{formatMoney(subtotal)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span>Packaging</span>
              <span>
                {packagingTotal > 0
                  ? formatMoney(packagingTotal)
                  : formatMoney(0)}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between text-base font-semibold text-gray-900">
              <span>Total</span>
              <span>{formatMoney(grandTotal)}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving || items.length === 0 || !isValid || loadingCart}
            className={`rounded-xl px-5 py-3 font-medium ${
              saving || items.length === 0 || !isValid || loadingCart
                ? "cursor-not-allowed bg-gray-300 text-gray-500"
                : "bg-black text-white hover:bg-gray-800"
            }`}
          >
            {saving ? "Redirecting…" : `Pay ${formatMoney(grandTotal)} with Paystack`}
          </button>
        </form>
      </main>

      {modalPackage && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {modalPackage.title}
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  {modalPackage.description || "No description provided."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalPackage(null)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100"
              >
                Close
              </button>
            </div>

            <div className="mt-4">
              <div className="aspect-square overflow-hidden rounded-2xl bg-gray-100">
                {modalPackage.images.length ? (
                  <img
                    key={`${modalPackage.id}-${modalImageIndex}`}
                    src={modalPackage.images[modalImageIndex]}
                    alt={modalPackage.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-gray-500">
                    No image
                  </div>
                )}
              </div>

              {modalPackage.images.length > 1 && (
                <div className="mt-3 flex gap-2 overflow-x-auto">
                  {modalPackage.images.map((img, idx) => (
                    <button
                      key={img + idx}
                      type="button"
                      onClick={() => setModalImageIndex(idx)}
                      className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border ${
                        idx === modalImageIndex
                          ? "border-black ring-2 ring-black"
                          : "border-gray-200"
                      }`}
                    >
                      <img
                        src={img}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-4 flex items-center justify-between text-sm text-gray-700">
                <span>Price</span>
                <span className="font-medium">
                  {formatMoney(modalPackage.price_cents)}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                <span>Available</span>
                <span>
                  {modalPackage.stock > 0
                    ? `${modalPackage.stock} in stock`
                    : "Out of stock"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
