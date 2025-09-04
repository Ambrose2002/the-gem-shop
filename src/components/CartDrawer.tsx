"use client";

import type { Product } from "@/types/product";
import Link from "next/link";
import { useCart } from "@/contexts/cart-data";

type Line = { product: Product; quantity: number };

type Props = {
  open: boolean;
  lines: Line[];
  subtotal: number;
  onClose: () => void;
};

function priceToGHS(cents: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "GHS",
  }).format(cents / 100);
}

export default function CartDrawer({ open, lines, subtotal, onClose }: Props) {
  const { remove, setQty } = useCart();

  return (
    <div
      className={`fixed inset-y-0 right-0 z-30 w-full max-w-md transform bg-white shadow-2xl transition-transform duration-300 ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
      role="dialog"
      aria-modal="true"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b p-4">
          <h3 className="text-lg font-semibold">Your cart</h3>
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100"
          >
            Close
          </button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {lines.length === 0 ? (
            <p className="text-sm text-gray-600">Your cart is empty.</p>
          ) : (
            lines.map(({ product, quantity }) => (
              <div key={product.id} className="flex items-center gap-3 rounded-xl border p-3">
                <div className="h-16 w-16 overflow-hidden rounded-lg">
                  {product.images?.[0] ? (
                    <img
                      className="h-full w-full object-cover"
                      src={product.images[0]}
                      alt={product.title}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-gray-500 bg-gray-100">
                      No image
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{product.title}</div>
                      <div className="text-xs text-gray-500">
                        {product.material} · {product.categories}
                      </div>
                    </div>
                    <div className="text-sm font-semibold">
                      {priceToGHS(product.price * quantity)}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <label className="text-xs text-gray-500">Qty</label>
                    <input
                      type="number"
                      min={1}
                      max={Math.max(0, product.stock)}
                      value={Math.min(quantity, Math.max(0, product.stock))}
                      onChange={(e) => {
                        const raw = Number(e.target.value) || 0;
                        const clamped = Math.max(1, Math.min(product.stock, raw));
                        setQty(product.id, clamped);
                      }}
                      disabled={product.stock <= 0}
                      className="w-16 rounded-md border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-100 disabled:text-gray-400"
                    />
                    {product.stock <= 0 ? (
                      <span className="text-xs text-red-600">Out of stock</span>
                    ) : (
                      <span className="text-xs text-gray-500">Max {product.stock}</span>
                    )}
                    <button
                      onClick={() => remove(product.id)}
                      className="ml-auto rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-100"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="border-t p-4">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span>Subtotal</span>
            <span className="font-semibold">{priceToGHS(subtotal)}</span>
          </div>
          <p className="mb-3 text-xs text-gray-500">Shipping calculated after purchase.</p>
          <Link
            href={lines.length === 0 ? "#" : "/request-order"}
            onClick={(e) => {
              if (lines.length === 0) e.preventDefault();
            }}
            className={`block w-full rounded-xl px-5 py-3 text-center ${
              lines.length === 0
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-black text-white hover:bg-gray-800"
            }`}
            aria-disabled={lines.length === 0}
          >
            Contact store to order
          </Link>
        </div>
      </div>
    </div>
  );
}