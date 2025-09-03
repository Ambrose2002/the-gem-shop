"use client";

import { useMemo, useState } from "react";
import { useCartUI } from "@/contexts/cart-ui";
import { useCartData } from "@/contexts/cart-data";
import ProductModal from "@/components/ProductModal";
import CartDrawer from "@/components/CartDrawer";
import ProductCard from "@/components/ProductCard";
import type { Product } from "@/types/product";

type ProductIn = {
  id: string;
  title: string;
  description: string;
  price: number; // cents
  stock: number;
  image: string | null;
  category: string;
};

function toUSD(cents: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);
}

export default function HomeClient({ initialProducts }: { initialProducts: ProductIn[] }) {
  const { open, isOpen, close } = useCartUI();
  const { lines, add, remove, setQty } = useCartData();

  // adapt to your existing ProductCard/ProductModal shape
  const products: Product[] = useMemo(() => {
    return initialProducts.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      price: p.price,
      stock: p.stock,
      category: p.category,
      material: "",
      images: p.image ? [p.image] : [],
    }));
  }, [initialProducts]);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category))).filter(Boolean),
    [products]
  );

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (category && p.category !== category) return false;
      if (maxPrice != null && p.price > maxPrice) return false;
      if (query && !`${p.title} ${p.material} ${p.description}`.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [products, category, maxPrice, query]);

  const cartDetailed = lines
    .map((line) => {
      const product = products.find((p) => p.id === line.productId);
      return product ? { product, quantity: line.quantity } : null;
    })
    .filter(Boolean) as { product: Product; quantity: number }[];

  const subtotal = cartDetailed.reduce((sum, l) => sum + l.product.price * l.quantity, 0);

  function addToCart(productId: string, qty = 1) { add(productId, qty); open(); }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* hero */}
      <section className="mx-auto max-w-6xl px-4 pt-10">
        <div className="grid gap-6 rounded-3xl bg-white p-8 shadow-sm md:grid-cols-2">
          <div className="flex flex-col justify-center">
            <h1 className="mb-2 text-3xl font-semibold text-gray-900 md:text-4xl">Handcrafted Jewelry</h1>
            <p className="text-gray-600">Minimal, timeless pieces designed for everyday elegance.</p>
            <div className="mt-6">
              <a href="#shop" className="rounded-2xl bg-black px-5 py-3 text-white shadow hover:opacity-90">Shop collection</a>
            </div>
          </div>
          <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-gray-100" />
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
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <select
              className="w-full rounded-xl border border-gray-300 text-gray-600 px-3 py-3"
              value={String(maxPrice ?? "")}
              onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">No price cap</option>
              <option value="6000">Up to {toUSD(6000)}</option>
              <option value="8000">Up to {toUSD(8000)}</option>
              <option value="10000">Up to {toUSD(10000)}</option>
              <option value="15000">Up to {toUSD(15000)}</option>
            </select>
          </div>
        </div>

        {/* grid */}
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-10 text-center text-gray-500">No products match your filters.</div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {filtered.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                onQuickView={(prod) => setActiveProduct(prod)}
                onAddToCart={(id) => addToCart(id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* product modal */}
      <ProductModal product={activeProduct} onClose={() => setActiveProduct(null)} onAdd={(id) => addToCart(id)} />

      {/* cart drawer */}
      <CartDrawer
        open={isOpen} onClose={close}
        lines={cartDetailed} subtotal={subtotal}
        onRemove={(id) => remove(id)} onQty={(id, q) => setQty(id, q)}
        onCheckout={() => alert("Checkout placeholder.")}
      />
    </div>
  );
}