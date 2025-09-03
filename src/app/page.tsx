// SERVER COMPONENT
import { createClientServer } from "@/lib/supabase/server";
import HomeClient from "./ui/HomeClient";

type ProductOut = {
  id: string;
  title: string;
  description: string;
  price: number; // cents
  stock: number;
  image: string | null;
  category: string;
};

export default async function HomePage() {
  const supabase = await createClientServer();

  const { data: products, error } = await supabase
    .from("products")
    .select("id, title, description, price_cents, stock, status, created_at")
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (error) {
    // render a small error (server-side)
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load products: {error.message}
        </div>
      </main>
    );
  }

  const ids = (products ?? []).map((p) => p.id);

  // first image per product
  const firstImageByProduct = new Map<string, string>();
  if (ids.length) {
    const { data: imgs } = await supabase
      .from("product_images")
      .select("product_id, url, sort")
      .in("product_id", ids)
      .order("sort", { ascending: true });
    (imgs ?? []).forEach((img) => {
      if (!firstImageByProduct.has(img.product_id)) {
        firstImageByProduct.set(img.product_id, img.url);
      }
    });
  }

  // simple category name (first)
  const nameByProduct = new Map<string, string>();
  if (ids.length) {
    const { data: pc } = await supabase
      .from("product_categories")
      .select("product_id, category_id")
      .in("product_id", ids);

    const catIds = Array.from(new Set((pc ?? []).map((r) => r.category_id)));
    if (catIds.length) {
      const { data: cats } = await supabase
        .from("categories")
        .select("id, name")
        .in("id", catIds);
      const nameById = new Map((cats ?? []).map((c) => [c.id, c.name]));
      (pc ?? []).forEach((r) => {
        if (!nameByProduct.has(r.product_id)) {
          nameByProduct.set(r.product_id, nameById.get(r.category_id) ?? "All");
        }
      });
    }
  }

  const out: ProductOut[] = (products ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description ?? "",
    price: p.price_cents,
    stock: p.stock,
    image: firstImageByProduct.get(p.id) ?? null,
    category: nameByProduct.get(p.id) ?? "All",
  }));

  return <HomeClient initialProducts={out} />;
}