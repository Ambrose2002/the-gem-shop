"use client";

import { useMemo, useState } from "react";
import { useCartUI } from "@/contexts/cart-ui";
import { useCart } from "@/contexts/cart-data";
import ProductModal from "@/components/ProductModal";
import CartDrawer from "@/components/CartDrawer";
import ProductCard from "@/components/ProductCard";
import type { Product } from "@/types/product";

type ProductIn = {
  id: string;
  title: string;
  description: string;
  price: number;     // in pesewas
  stock: number;
  images: string[];
  categories: string[];
};

function toGHS(cents: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "GHS",
  }).format(cents / 100);
}

export default function HomeClient({
  initialProducts,
}: {
  initialProducts: ProductIn[];
}) {
  const { isOpen, close } = useCartUI();
  const { lines } = useCart(); // ✅ only need lines now

  // adapt ProductIn -> Product used by UI components
  const products: Product[] = useMemo(() => {
    return initialProducts.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      price: p.price,
      stock: p.stock,
      categories: p.categories ?? [],
      material: "",
      images: p.images ?? [],
    }));
  }, [initialProducts]);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);

  const categories = useMemo(
    () =>
      Array.from(new Set(products.flatMap((p) => p.categories))).filter(
        Boolean
      ) as string[],
    [products]
  );

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (category && !p.categories.includes(category)) return false;
      if (maxPrice != null && p.price > maxPrice) return false;
      if (
        query &&
        !`${p.title} ${p.material} ${p.description}`
          .toLowerCase()
          .includes(query.toLowerCase())
      )
        return false;
      return true;
    });
  }, [products, category, maxPrice, query]);

  // Build cart view (product + qty) from server-backed lines
  const cartDetailed = lines
    .map((line) => {
      const product = products.find((p) => p.id === line.productId);
      return product ? { product, quantity: line.quantity } : null;
    })
    .filter(Boolean) as { product: Product; quantity: number }[];

  const subtotal = cartDetailed.reduce(
    (sum, l) => sum + l.product.price * l.quantity,
    0
  );

  function resetFilters() {
    setQuery("");
    setCategory(null);
    setMaxPrice(null);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* hero */}
      <section className="mx-auto max-w-6xl px-4 pt-10">
        <div className="grid gap-6 rounded-3xl bg-white p-8 shadow-sm md:grid-cols-2">
          <div className="flex flex-col justify-center">
            <h1 className="mb-2 text-3xl font-semibold text-gray-900 md:text-4xl">
              Refined Jewelry Collection
            </h1>
            <p className="text-gray-600">
              Minimal, timeless pieces designed for everyday elegance.
            </p>
            <div className="mt-6 flex gap-3">
              <a
                href="#shop"
                className="rounded-2xl bg-black px-5 py-3 text-white shadow hover:opacity-90"
              >
                Shop collection
              </a>
              <button
                type="button"
                onClick={resetFilters}
                className="rounded-2xl border border-gray-300 px-5 py-3 text-gray-700 hover:bg-gray-100"
              >
                Reset filters
              </button>
            </div>
          </div>

          {/* BIG IMAGE (brand logo) */}
          <div className="flex items-center justify-center rounded-2xl bg-white">
            <img
              src="/brand/logo.png"
              alt="The Gem Shop logo"
              className="h-64 w-auto rounded-2xl object-contain md:h-80"
              loading="eager"
            />
          </div>
        </div>
      </section>

      {/* controls */}
      <section id="shop" className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products…"
              className="w-full rounded-xl border border-gray-300 text-gray-600 px-4 py-3 focus:outline-none"
            />
          </div>
          <div>
            <select
              className="w-full rounded-xl border border-gray-300 text-gray-600 px-3 py-3"
              value={category ?? ""}
              onChange={(e) => setCategory(e.target.value || null)}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <select
              className="w-full rounded-xl border border-gray-300 text-gray-600 px-3 py-3"
              value={String(maxPrice ?? "")}
              onChange={(e) =>
                setMaxPrice(e.target.value ? Number(e.target.value) : null)
              }
            >
              <option value="">No price cap</option>
              <option value="2000">Up to {toGHS(2000)}</option>
              <option value="4000">Up to {toGHS(4000)}</option>
              <option value="8000">Up to {toGHS(8000)}</option>
              <option value="12000">Up to {toGHS(12000)}</option>
            </select>
          </div>
        </div>

        {/* grid */}
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-10 text-center text-gray-500">
            No products match your filters.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {filtered.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                onQuickView={(prod) => setActiveProduct(prod)}
              />
            ))}
          </div>
        )}
      </section>

      {/* product modal */}
      <ProductModal
        product={activeProduct}
        onClose={() => setActiveProduct(null)}
      />

      {/* cart drawer */}
      <CartDrawer
        open={isOpen}
        onClose={close}
        lines={cartDetailed}
        subtotal={subtotal}
      />
    </div>
  );
}