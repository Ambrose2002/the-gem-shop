import Link from "next/link";
import { createClientServer } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// Single-file server component with URL-query filtering (?delivered=all|yes|no)
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ delivered?: string; confirm?: string; value?: string }>;
}) {
  // Server action for toggling delivered flag
  async function toggleDelivered(formData: FormData) {
    "use server";
    const id = String(formData.get("order_id"));
    const value = String(formData.get("value")) === "true";
    const back = String(formData.get("back") || "/admin/orders");
    const supabase = await createClientServer();
    await supabase.from("orders").update({ delivered: value }).eq("id", id);
    revalidatePath(back);
    redirect(back);
  }

  const sp = await searchParams;
  const deliveredFilter = (sp?.delivered ?? "all").toLowerCase(); // "all" | "yes" | "no"
  const confirmId = sp?.confirm || "";
  const confirmValue = sp?.value === "true";

  const supabase = await createClientServer();
  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, created_at, amount_cents, phone, city, address, delivery_payment, status, delivered, user_id"
    )
    .order("created_at", { ascending: false });

  const filtered = (orders ?? []).filter((o) => {
    if (deliveredFilter === "yes") return !!o.delivered;
    if (deliveredFilter === "no") return !o.delivered;
    return true;
  });

  const money = (n: number) => `GH₵${(n / 100).toFixed(2)}`;

  // Helper to build href with the active filter
  const hrefFilter = (val: "all" | "yes" | "no") =>
    val === "all" ? "/admin/orders" : `/admin/orders?delivered=${val}`;

  const hrefConfirm = (id: string, value: boolean) => {
    const base = deliveredFilter === "all" ? "/admin/orders" : `/admin/orders?delivered=${deliveredFilter}`;
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}confirm=${encodeURIComponent(id)}&value=${value}`;
  };

  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-semibold">Orders</h1>

      <div className="mb-4 flex items-center gap-2">
        <Link
          href="/admin/products"
          className="rounded-lg bg-black px-4 py-2 text-white"
        >
          Back to Products
        </Link>

        {/* Filter buttons */}
        <div className="ml-auto flex gap-2">
          <Link
            href={hrefFilter("all")}
            className={`rounded px-3 py-1 ${
              deliveredFilter === "all"
                ? "bg-black text-white"
                : "bg-gray-200 text-gray-900"
            }`}
          >
            All
          </Link>
          <Link
            href={hrefFilter("yes")}
            className={`rounded px-3 py-1 ${
              deliveredFilter === "yes"
                ? "bg-black text-white"
                : "bg-gray-200 text-gray-900"
            }`}
          >
            Delivered
          </Link>
          <Link
            href={hrefFilter("no")}
            className={`rounded px-3 py-1 ${
              deliveredFilter === "no"
                ? "bg-black text-white"
                : "bg-gray-200 text-gray-900"
            }`}
          >
            Not Delivered
          </Link>
        </div>
      </div>

      <table className="w-full border">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="p-2">Phone</th>
            <th className="p-2">City</th>
            <th className="p-2">Address</th>
            <th className="p-2">Delivery Payment</th>
            <th className="p-2">Delivered</th>
            <th className="p-2">Amount</th>
            <th className="p-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((o) => (
            <tr key={o.id} className="border-t">
              <td className="p-2">{o.phone ?? "-"}</td>
              <td className="p-2">{o.city ?? "-"}</td>
              <td className="p-2">{o.address ?? "-"}</td>
              <td className="p-2">
                {o.delivery_payment === "after"
                  ? "After delivery"
                  : "Before delivery"}
              </td>
              <td className="p-2">
                {confirmId === o.id ? (
                  <form action={toggleDelivered} className="inline-flex items-center gap-2">
                    <input type="hidden" name="order_id" value={o.id} />
                    <input type="hidden" name="value" value={confirmValue.toString()} />
                    <input type="hidden" name="back" value={hrefFilter(deliveredFilter as any)} />
                    <span className="text-xs text-gray-700">
                      {confirmValue ? "Mark as delivered?" : "Mark as NOT delivered?"}
                    </span>
                    <button
                      type="submit"
                      className="rounded bg-black px-2 py-1 text-xs text-white"
                    >
                      Confirm
                    </button>
                    <Link
                      href={hrefFilter(deliveredFilter as any)}
                      className="rounded bg-gray-200 px-2 py-1 text-xs text-gray-900"
                    >
                      Cancel
                    </Link>
                  </form>
                ) : (
                  <Link
                    href={hrefConfirm(o.id, !o.delivered)}
                    className={`rounded px-2 py-1 text-xs ${
                      o.delivered ? "bg-green-600 text-white" : "bg-gray-300 text-gray-800"
                    }`}
                    title={o.delivered ? "Mark as not delivered" : "Mark as delivered"}
                  >
                    {o.delivered ? "Delivered" : "Not delivered"}
                  </Link>
                )}
              </td>
              <td className="p-2">{money(o.amount_cents)}</td>
              <td className="p-2">{o.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}