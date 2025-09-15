import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const PAYSTACK_BASE = "https://api.paystack.co";

type CheckoutBody = {
  phone?: string;
  city?: string;
  address?: string;
  deliveryPayment?: "before" | "after";
};

export async function POST(req: NextRequest) {
  const jar = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (list) =>
          list.forEach(({ name, value, options }) =>
            jar.set({ name, value, ...options })
          ),
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Parse request body for phone + city + address + deliveryPayment
  const body: CheckoutBody = await req.json().catch(() => ({} as CheckoutBody));
  const phone = (body.phone ?? '').trim();
  const city = (body.city ?? '').trim();
  const address = (body.address ?? '').trim();
  const deliveryPayment: "before" | "after" = body.deliveryPayment === "after" ? "after" : "before"; // default

  const GH_PHONE = /^(\+233\d{9}|0\d{9})$/;
  if (!GH_PHONE.test(phone) || city.length < 2 || address.length < 3) {
    return NextResponse.json({ error: "Invalid contact details" }, { status: 400 });
  }

  // Helper to normalize product relation (can be object or array)
  type ProductMini = { title: string; price_cents: number };
  const pickProduct = (p: ProductMini | ProductMini[] | null): ProductMini | null => Array.isArray(p) ? (p[0] ?? null) : p;

  // Load cart and items (same as before)
  const { data: cart } = await supabase
    .from("carts")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!cart) return NextResponse.json({ error: "Cart empty" }, { status: 400 });

  const { data: items } = await supabase
    .from("cart_items")
    .select("product_id, quantity, products(title, price_cents)")
    .eq("cart_id", cart.id);

  const lines = (items ?? []).map((r: any) => {
    const prod = pickProduct(r.products ?? null);
    const unit = Number(prod?.price_cents ?? 0);
    const qty = Number(r.quantity ?? 0);
    return {
      product_id: r.product_id as string,
      title: (prod?.title ?? "") as string,
      unit,
      qty,
      total: unit * qty,
    };
  });

  const amount_cents = lines.reduce((s, l) => s + l.total, 0);
  if (amount_cents <= 0) return NextResponse.json({ error: "Cart empty" }, { status: 400 });

  // Insert order with phone + city + address + delivery_payment
  const { data: order, error: ordErr } = await supabase
    .from("orders")
    .insert({
      user_id: user.id,
      amount_cents,
      currency: "GHS",
      status: "pending",
      provider: "paystack",
      phone,
      city,
      address,
      delivery_payment: deliveryPayment,
    })
    .select("id")
    .single();
  if (ordErr) return NextResponse.json({ error: ordErr.message }, { status: 500 });

  // Save order_items snapshot
  await supabase.from("order_items").insert(
    lines.map((l) => ({
      order_id: order.id,
      product_id: l.product_id,
      title: l.title,
      unit_price_cents: l.unit,
      quantity: l.qty,
      line_total_cents: l.total,
    }))
  );

  // Initialize Paystack
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;
  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY!}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: user.email ?? "customer@example.com",
      amount: amount_cents,
      currency: "GHS",
      reference: order.id,
      callback_url: `${site}/payment/callback`,
      metadata: { order_id: order.id, phone, city, address, deliveryPayment, user_id: user.id },
    }),
  });

  const data = await res.json();
  if (!res.ok || !data?.status) {
    return NextResponse.json({ error: data?.message ?? "Payment init failed" }, { status: 400 });
  }

  return NextResponse.json({ url: data.data.authorization_url });
}