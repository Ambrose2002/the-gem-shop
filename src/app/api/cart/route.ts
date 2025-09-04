import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function GET() {
  const jar = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll(){ return jar.getAll(); }, setAll(list){ list.forEach(({name,value,options}) => jar.set({name,value,...options})) } } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: true, lines: [], subtotal: 0 });

  const { data: cart } = await supabase.from("carts")
    .select("id").eq("user_id", user.id).eq("status","active").maybeSingle();
  if (!cart) return NextResponse.json({ ok: true, lines: [], subtotal: 0 });

  const { data: rows } = await supabase.from("cart_items")
    .select("product_id, quantity").eq("cart_id", cart.id);

  const productIds = (rows ?? []).map(r => r.product_id);
  let subtotal = 0;

  if (productIds.length) {
    const { data: prods } = await supabase.from("products")
      .select("id, price_cents").in("id", productIds);
    const price = new Map((prods ?? []).map(p => [p.id, Number(p.price_cents||0)]));
    subtotal = (rows ?? []).reduce((s, r:any) => s + (price.get(r.product_id) ?? 0) * Number(r.quantity||0), 0);
  }

  return NextResponse.json({ ok: true, lines: rows ?? [], subtotal });
}