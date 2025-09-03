"use client";

import { useEffect, useState } from "react";
import type { Product } from "@/types/product";

type Props = {
  product: Product | null;
  onClose: () => void;
  onAdd: (id: string) => void;
};

export default function ProductModal({ product, onClose, onAdd }: Props) {
  const [active, setActive] = useState(0);

  // When a different product opens, start from the first image
  useEffect(() => {
    setActive(0);
  }, [product?.id]);

  if (!product) return null;

  const imgs = product.images ?? [];
  const hasImages = imgs.length > 0;
  const mainSrc = hasImages ? imgs[Math.min(active, imgs.length - 1)] : undefined;

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-xl">
        {/* header */}
        <div className="flex items-start justify-between">
          <h3 className="text-xl font-semibold">{product.title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100"
          >
            Close
          </button>
        </div>

        <div className="mt-4 grid gap-6 md:grid-cols-2">
          {/* Left: gallery */}
          <div>
            {/* Main image */}
            <div className="aspect-square overflow-hidden rounded-2xl bg-gray-100">
              {mainSrc ? (
                <img
                  key={mainSrc} // helps reset transition when active changes
                  src={mainSrc}
                  alt={product.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-gray-500">
                  No image
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {imgs.length > 1 && (
              <div className="mt-3 grid grid-cols-5 gap-2">
                {imgs.map((src, i) => {
                  const isActive = i === active;
                  return (
                    <button
                      key={src + i}
                      type="button"
                      onClick={() => setActive(i)}
                      className={[
                        "relative aspect-square overflow-hidden rounded-lg border",
                        isActive
                          ? "border-black ring-2 ring-black"
                          : "border-gray-200 hover:border-gray-300",
                      ].join(" ")}
                      aria-label={`View image ${i + 1}`}
                    >
                      <img src={src} alt="" className="h-full w-full object-cover" />
                      {isActive && (
                        <span className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-black" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: details */}
          <div>
            <p className="mt-2 text-sm text-gray-600">{product.description}</p>
            <ul className="mt-4 list-disc pl-5 text-sm text-gray-600">
              <li>Category: {product.category}</li>
              <li>
                Availability:{" "}
                {product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
              </li>
            </ul>

            <div className="mt-6 flex gap-3">
              <button
                className="flex-1 rounded-2xl border border-gray-300 px-4 py-3 hover:bg-gray-100"
                onClick={onClose}
              >
                Keep browsing
              </button>
              <button
                className="flex-1 rounded-2xl bg-black px-4 py-3 text-white disabled:opacity-50"
                onClick={() => {
                  onAdd(product.id);
                  onClose();
                }}
                disabled={product.stock <= 0}
              >
                Add to cart
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}