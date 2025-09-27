export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const PAYSTACK_BASE = "https://api.paystack.co";
async function verifyTransaction(reference: string) {
  const resp = await fetch(`${PAYSTACK_BASE}/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY!}` },
    cache: "no-store",
  });
  const json = await resp.json().catch(() => ({} as any));
  return { ok: resp.ok, json } as const;
}

export async function POST(req: NextRequest) {
  // Verify signature
  const secret = process.env.PAYSTACK_SECRET_KEY!;
  const raw = await req.text();
  const sig = req.headers.get("x-paystack-signature") ?? "";
  const expected = crypto.createHmac("sha512", secret).update(raw).digest("hex");
  if (sig !== expected) return NextResponse.json({ ok: false }, { status: 401 });

  let evt: any = {};
  try {
    evt = JSON.parse(raw);
  } catch (e) {
    console.error("[paystack webhook] invalid JSON body");
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const orderId = evt?.data?.reference as string | undefined;
  if (!orderId) {
    console.error("[paystack webhook] missing reference in payload");
    return NextResponse.json({ ok: true });
  }

  // Verify with Paystack to be absolutely sure
  const verify = await verifyTransaction(orderId);
  const verifiedStatus = verify.json?.data?.status; // 'success' | 'failed' | ...
  if (!verify.ok || verifiedStatus !== "success") {
    console.warn("[paystack webhook] verification says not successful", { reference: orderId, verifiedStatus, httpOk: verify.ok });
    return NextResponse.json({ ok: true });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: order } = await supabase
    .from("orders")
    .select("id, user_id, status")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return NextResponse.json({ ok: true });

  const { data: orderItems } = await supabase
    .from("order_items")
    .select("product_id, quantity")
    .eq("order_id", order.id);

  const shouldProcess = order.status === "pending";

  if (shouldProcess) {
    for (const row of orderItems ?? []) {
      const qty = Number(row.quantity ?? 0);
      const productId = row.product_id as string | undefined;
      if (!productId || qty <= 0) continue;

      const { error: decErr } = await supabase.rpc("decrement_stock", {
        p_product_id: productId,
        p_qty: qty,
      });

      if (decErr) {
        console.warn("[paystack webhook] decrement_stock failed", {
          product_id: productId,
          qty,
          error: decErr.message,
        });

        const { data: product } = await supabase
          .from("products")
          .select("stock")
          .eq("id", productId)
          .maybeSingle();
        if (product && typeof product.stock !== "undefined") {
          const nextStock = Math.max(0, Number(product.stock ?? 0) - qty);
          await supabase
            .from("products")
            .update({ stock: nextStock })
            .eq("id", productId);
        }
      }
    }

    await supabase
      .from("orders")
      .update({ status: "paid" })
      .eq("id", order.id);
  }

  const { data: cart } = await supabase
    .from("carts")
    .select("id")
    .eq("user_id", order.user_id)
    .eq("status", "active")
    .maybeSingle();
  if (cart) {
    await supabase.from("cart_items").delete().eq("cart_id", cart.id);
  }

  const { data: fullOrder } = await supabase
    .from("orders")
    .select("id, amount_cents, phone, city, address, delivery_payment, created_at")
    .eq("id", order.id)
    .maybeSingle();

  const { data: orderLines } = await supabase
    .from("order_items")
    .select("title, unit_price_cents, quantity, line_total_cents")
    .eq("order_id", order.id);

  if (shouldProcess) {
    try {
      const customerEmail: string | undefined = evt?.data?.customer?.email ?? undefined;
      const storeTo = process.env.STORE_OWNER_EMAIL!;
      const from = `The Real Gem Shop <${process.env.FROM_EMAIL!}>`;

    const money = (n: number) => `GH₵${(n / 100).toFixed(2)}`;
    const linesText = (orderLines ?? [])
      .map((l) => `• ${l.title} × ${l.quantity} — ${money(l.line_total_cents)}`)
      .join("\n");
    const linesHtml = (orderLines ?? [])
      .map(
        (l) =>
          `<li>${l.title} × ${l.quantity} — <strong>${money(l.line_total_cents)}</strong></li>`
      )
      .join("");

    const total = fullOrder ? money(fullOrder.amount_cents) : "(unknown)";
    const contactBlock = fullOrder
      ? `Phone: ${fullOrder.phone ?? "-"}\nCity: ${fullOrder.city ?? "-"}\nAddress: ${fullOrder.address ?? "-"}`
      : "";

    const resend = new Resend(process.env.RESEND_API_KEY!);
    await resend.emails.send({
      from,
      to: storeTo,
      subject: `Paid order ${order.id} — ${total}`,
      replyTo: customerEmail,
      text: `A payment was confirmed via Paystack.\n\nOrder ID: ${order.id}\nTotal: ${total}\n\nItems:\n${linesText}\n\nCustomer contact:\n${contactBlock}\n\nDelivery payment: ${fullOrder?.delivery_payment === 'after' ? 'After delivery' : 'Before delivery'}\n\nPlaced at: ${fullOrder?.created_at ?? ""}`,
      html: `
        <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; line-height:1.5; color:#111">
          <h2>New paid order</h2>
          <p><strong>Order ID:</strong> ${order.id}</p>
          <p><strong>Total:</strong> ${total}</p>
          <h3 style="margin-top:16px;margin-bottom:8px;">Items</h3>
          <ul>${linesHtml}</ul>
          <h3 style="margin-top:16px;margin-bottom:8px;">Customer contact</h3>
          <p>
            ${fullOrder?.phone ? `Phone: ${fullOrder.phone}<br/>` : ""}
            ${fullOrder?.city ? `City: ${fullOrder.city}<br/>` : ""}
            ${fullOrder?.address ? `Address: ${fullOrder.address}<br/>` : ""}
            ${customerEmail ? `Email: ${customerEmail}` : ""}
            ${fullOrder?.delivery_payment ? `Delivery payment: ${fullOrder.delivery_payment === "after" ? "After delivery" : "Before delivery"}<br/>` : ""}
          </p>
          <p style="margin-top:16px;color:#666;">Placed at: ${fullOrder?.created_at ?? ""}</p>
        </div>
      `,
    });
    } catch (mailErr) {
      console.warn("[paystack webhook] email notify failed", mailErr);
    }
  }

  return NextResponse.json({ ok: true });
}
