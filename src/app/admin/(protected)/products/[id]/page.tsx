// src/app/admin/(protected)/products/[id]/page.tsx
import { createClientServer } from "@/lib/supabase/server";
import AdminShell from "@/components/AdminShell";
import EditForm from "./ui/EditForm";
import Link from "next/link";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;               // ⬅️ await params here
  const supabase = await createClientServer();

  const { data: product, error } = await supabase
    .from("products")
    .select("id, title, description, price_cents, stock, status, slug")
    .eq("id", id)                            // ⬅️ use id
    .maybeSingle();

  if (error) {
    return (
      <AdminShell title="Edit product">
        <p className="text-sm text-red-600">{error.message}</p>
        <Link href="/admin/products" className="underline">Back</Link>
      </AdminShell>
    );
  }
  if (!product) {
    return (
      <AdminShell title="Edit product">
        <p className="text-gray-600">Product not found.</p>
        <Link href="/admin/products" className="underline">Back</Link>
      </AdminShell>
    );
  }

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name")
    .order("name", { ascending: true });

  const { data: pc } = await supabase
    .from("product_categories")
    .select("category_id")
    .eq("product_id", product.id);

  const selectedCategoryIds = (pc ?? []).map((r) => r.category_id);

  const { data: images } = await supabase
    .from("product_images")
    .select("id, url, sort")
    .eq("product_id", product.id)
    .order("sort", { ascending: true });

  return (
    <AdminShell title={`Edit: ${product.title}`}>
      <EditForm
        initial={product}
        images={images ?? []}
        categories={categories ?? []}
        selectedCategoryIds={selectedCategoryIds}
      />
    </AdminShell>
  );
}