import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  // Ensure active cart
  const { data: cart } = await supabase
    .from("carts")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!cart) return NextResponse.json({ ok: false }, { status: 400 });

  // Look up current stock
  const { data: prod } = await supabase
    .from("products")
    .select("stock")
    .eq("id", productId)
    .maybeSingle();

  const stock = Math.max(0, Number(prod?.stock ?? 0));
  const requested = Math.max(0, Number(quantity) || 0);
  const clamped = Math.min(stock, requested);

  // If clamped is 0 (or no stock), delete the line
  if (clamped <= 0) {
    await supabase
      .from("cart_items")
      .delete()
      .eq("cart_id", cart.id)
      .eq("product_id", productId);
    return NextResponse.json({ ok: true, quantity: 0, stock });
  }

  // Upsert to exact clamped quantity (safe with unique(cart_id, product_id))
  const { error: upsertErr } = await supabase
    .from("cart_items")
    .upsert([{ cart_id: cart.id, product_id: productId, quantity: clamped }], {
      onConflict: "cart_id,product_id",
    });

  if (upsertErr) {
    return NextResponse.json(
      { ok: false, error: upsertErr.message },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, quantity: clamped, stock });
}
