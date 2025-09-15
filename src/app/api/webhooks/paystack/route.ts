import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function POST(req: NextRequest) {
  // Verify signature
  const secret = process.env.PAYSTACK_SECRET_KEY!;
  const raw = await req.text();
  const sig = req.headers.get("x-paystack-signature") ?? "";
  const expected = crypto.createHmac("sha512", secret).update(raw).digest("hex");
  if (sig !== expected) return NextResponse.json({ ok: false }, { status: 401 });

  const evt = JSON.parse(raw);
  if (evt.event !== "charge.success") return NextResponse.json({ ok: true });

  const orderId = evt.data?.reference as string | undefined;
  if (!orderId) return NextResponse.json({ ok: false }, { status: 400 });

  const jar = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => jar.getAll(), setAll: (l) => l.forEach(c => jar.set({ ...c })) } }
  );

  const { data: order } = await supabase.from("orders")
    .select("id, user_id, status").eq("id", orderId).maybeSingle();
  if (!order) return NextResponse.json({ ok: true });

  if (order.status === "pending") {
    // Decrement stock per item
    const { data: items } = await supabase.from("order_items")
      .select("product_id, quantity").eq("order_id", order.id);
    for (const it of items ?? []) {
      const { error: decErr } = await supabase.rpc("decrement_stock", {
        p_product_id: it.product_id,
        p_qty: it.quantity,
      });
      if (decErr) {
        // Log and continue; do not throw to avoid failing the webhook
        console.warn("[paystack webhook] decrement_stock failed", {
          product_id: it.product_id,
          qty: it.quantity,
          error: decErr.message,
        });
      }
    }

    // Mark paid
    await supabase.from("orders").update({ status: "paid" }).eq("id", order.id);

    // Clear the active cart
    const { data: cart } = await supabase
      .from("carts").select("id").eq("user_id", order.user_id).eq("status","active").maybeSingle();
    if (cart) await supabase.from("cart_items").delete().eq("cart_id", cart.id);
  }

  return NextResponse.json({ ok: true });
}