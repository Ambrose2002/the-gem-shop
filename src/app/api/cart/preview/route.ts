import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function GET() {
  const jar = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return jar.getAll(); },
        setAll(list) { list.forEach(({ name, value, options }) => jar.set({ name, value, ...options })); },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: true, items: [], subtotal: 0 });

  // active cart
  const { data: cart } = await supabase
    .from("carts").select("id")
    .eq("user_id", user.id).eq("status", "active")
    .maybeSingle();
  if (!cart) return NextResponse.json({ ok: true, items: [], subtotal: 0 });

  // cart lines
  const { data: rows, error: ciErr } = await supabase
    .from("cart_items").select("product_id, quantity")
    .eq("cart_id", cart.id);
  if (ciErr || !rows?.length) return NextResponse.json({ ok: true, items: [], subtotal: 0 });

  const productIds = rows.map(r => r.product_id);

  // products
  const { data: prods, error: pErr } = await supabase
    .from("products").select("id, title, price_cents")
    .in("id", productIds);
  if (pErr) return NextResponse.json({ ok: false, error: pErr.message }, { status: 500 });

  const prodMap = new Map<string, { title: string; price_cents: number }>();
  (prods ?? []).forEach(p => {
    prodMap.set(p.id as string, {
      title: (p.title as string) ?? "(untitled)",
      price_cents: Number(p.price_cents ?? 0),
    });
  });

  // first image per product (optional)
  const { data: imgs } = await supabase
    .from("product_images")
    .select("product_id, url, sort")
    .in("product_id", productIds)
    .order("sort", { ascending: true });

  const firstImg = new Map<string, string>();
  (imgs ?? []).forEach(i => { if (!firstImg.has(i.product_id)) firstImg.set(i.product_id, i.url); });

  const items = rows.map(r => {
    const p = prodMap.get(r.product_id) ?? { title: "(untitled)", price_cents: 0 };
    return {
      productId: r.product_id,
      title: p.title,
      price_cents: p.price_cents,
      quantity: Number(r.quantity ?? 0),
      image: firstImg.get(r.product_id) ?? null,
    };
  });

  const subtotal = items.reduce((s, it) => s + it.price_cents * it.quantity, 0);

  return NextResponse.json({ ok: true, items, subtotal });
}