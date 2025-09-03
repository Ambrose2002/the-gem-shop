// src/app/admin/(protected)/products/new/page.tsx
// SERVER COMPONENT
import { createClientServer } from "@/lib/supabase/server";
import AdminShell from "@/components/AdminShell";
import NewProductForm from "./ui/NewProductForm";

export default async function NewProductPage() {
  const supabase = await createClientServer();

  const { data: categories, error } = await supabase
    .from("categories")
    .select("id, name")
    .order("name", { ascending: true });

  if (error) {
    return (
      <AdminShell title="New product">
        <p className="text-sm text-red-600">{error.message}</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="New product">
      <NewProductForm categories={categories ?? []} />
    </AdminShell>
  );
}