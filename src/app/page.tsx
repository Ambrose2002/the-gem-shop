// SERVER COMPONENT
import { createClientServer } from "@/lib/supabase/server";
import HomeClient from "./ui/HomeClient";

type ProductOut = {
  id: string;
  title: string;
  description: string;
  price: number; // cents
  stock: number;
  images: string[]; // ⬅️ was: image: string | null
  categories: string[];
};

export default async function HomePage() {
  const supabase = await createClientServer();

  const { data: products, error } = await supabase
    .from("products")
    .select("id, title, description, price_cents, stock, status, created_at")
    .eq("status", "published")
    .is("deleted_at", null)
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

  // all images per product (ordered)
  const imagesByProduct = new Map<string, string[]>();
  if (ids.length) {
    const { data: imgs } = await supabase
      .from("product_images")
      .select("product_id, url, sort")
      .in("product_id", ids)
      .order("sort", { ascending: true });

    (imgs ?? []).forEach((img) => {
      const list = imagesByProduct.get(img.product_id) ?? [];
      list.push(img.url);
      imagesByProduct.set(img.product_id, list);
    });
  }

  // simple category name (first)
  const categoriesByProduct = new Map<string, string[]>();
  if (ids.length) {
    const { data: pc } = await supabase
      .from("product_categories")
      .select("product_id, category_id")
      .in("product_id", ids);

    const catIds = Array.from(new Set((pc ?? []).map((r) => r.category_id)));
    const { data: cats } = await supabase
      .from("categories")
      .select("id, name")
      .in("id", catIds);

    const nameByCat = new Map(
      (cats ?? []).map((c) => [c.id, c.name as string])
    );
    (pc ?? []).forEach((r) => {
      const list = categoriesByProduct.get(r.product_id) ?? [];
      const name = nameByCat.get(r.category_id);
      if (name && !list.includes(name)) list.push(name);
      categoriesByProduct.set(r.product_id, list);
    });
  }

  const out: ProductOut[] = (products ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description ?? "",
    price: p.price_cents,
    stock: p.stock,
    images: imagesByProduct.get(p.id) ?? [], // ⬅️ was: image: firstImageByProduct.get(...)
    categories: categoriesByProduct.get(p.id) ?? [],
  }));

  return <HomeClient initialProducts={out} />;
}
