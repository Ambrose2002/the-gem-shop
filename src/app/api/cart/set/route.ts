import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function PATCH(req: Request) {
  const { productId, quantity } = await req.json();
  const jar = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return jar.getAll(); // [{ name, value, ... }]
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            jar.set({ name, value, ...options });
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const { data: cart } = await supabase.from("carts").select("id").eq("user_id", user.id).eq("status","active").maybeSingle();
  if (!cart) return NextResponse.json({ ok: false }, { status: 400 });

  if (quantity <= 0) {
    await supabase.from("cart_items").delete().eq("cart_id", cart.id).eq("product_id", productId);
    return NextResponse.json({ ok: true });
  }

  const { data: existing } = await supabase
    .from("cart_items").select("id").eq("cart_id", cart.id).eq("product_id", productId).maybeSingle();

  if (existing) {
    const { error } = await supabase.from("cart_items").update({ quantity: Math.min(99, Number(quantity)) }).eq("id", existing.id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  } else {
    const { error } = await supabase.from("cart_items").insert({ cart_id: cart.id, product_id: productId, quantity: Math.min(99, Number(quantity)) });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}