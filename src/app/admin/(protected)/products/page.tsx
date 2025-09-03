import Link from "next/link";
import { createClientServer } from "@/lib/supabase/server";
import AdminShell from "@/components/AdminShell";
import DeleteProductButton from "@/components/admin/DeleteProductButton";

export const dynamic = "force-dynamic";

export default async function AdminProducts() {
  const supabase = await createClientServer();
  const { data: products, error } = await supabase
    .from("products")
    .select("id, title, slug, price_cents, stock, status, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <AdminShell title="Products">
        <p className="text-sm text-red-600">Error: {error.message}</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="Products"
      actions={
        <Link
          href="/admin/products/new"
          className="rounded-lg bg-black px-4 py-2 text-white"
        >
          New product
        </Link>
      }
    >
      <div className="overflow-auto rounded-xl border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-gray-50">
            <tr className="text-gray-600">
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Stock</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(products ?? []).map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-4 py-3 text-gray-600">{p.title}</td>
                <td className="px-4 py-3 text-gray-600">
                  ${(p.price_cents / 100).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-gray-600">{p.stock}</td>
                <td className="px-4 py-3 text-gray-600">{p.status}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/admin/products/${p.id}`}
                      className="text-gray-600 underline"
                    >
                      Edit
                    </Link>

                    {/* Soft delete (default). For hard delete in place, pass hard */}
                    <DeleteProductButton id={p.id} title={p.title} />
                    {/* <DeleteProductButton id={p.id} title={p.title} hard /> */}
                  </div>
                </td>
              </tr>
            ))}
            {(!products || products.length === 0) && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No products yet. Click “New product” to add one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
