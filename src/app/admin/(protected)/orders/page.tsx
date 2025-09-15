import { createClientServer } from "@/lib/supabase/server";

export default async function OrdersPage() {
  const supabase = await createClientServer();
  const { data: orders } = await supabase
    .from("orders")
    .select("id, created_at, amount_cents, phone, city, address, delivery_payment, status, user_id")
    .order("created_at", { ascending: false });

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Orders</h1>
      <table className="w-full border">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="p-2">Phone</th>
            <th className="p-2">City</th>
            <th className="p-2">Address</th>
            <th className="p-2">Delivery Payment</th>
            <th className="p-2">Amount</th>
            <th className="p-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {orders?.map((o) => (
            <tr key={o.id} className="border-t">
              <td className="p-2">{o.phone ?? "-"}</td>
              <td className="p-2">{o.city ?? "-"}</td>
              <td className="p-2">{o.address ?? "-"}</td>
              <td className="p-2">{o.delivery_payment === "after" ? "After delivery" : "Before delivery"}</td>
              <td className="p-2">GH₵{(o.amount_cents / 100).toFixed(2)}</td>
              <td className="p-2">{o.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}