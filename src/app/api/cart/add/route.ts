import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function POST(req: Request) {
  const { productId, quantity = 1 } = await req.json();

  const jar = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return jar.getAll();
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

  // Ensure cart
  let { data: cart } = await supabase
    .from("carts")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!cart) {
    const { data: newCart, error } = await supabase
      .from("carts")
      .insert({ user_id: user.id, status: "active" })
      .select("id")
      .single();
    if (error)
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    cart = newCart;
  }

  // ⬇️ NEW: look up current stock and clamp the next quantity
  const { data: prod } = await supabase
    .from("products")
    .select("stock")
    .eq("id", productId)
    .maybeSingle();

  const stock = Math.max(0, Number(prod?.stock ?? 0));
  const requested = Math.max(1, Number(quantity) || 1);

  // Existing line (if any)
  const { data: existing } = await supabase
    .from("cart_items")
    .select("id, quantity")
    .eq("cart_id", cart.id)
    .eq("product_id", productId)
    .maybeSingle();

  const current = Number(existing?.quantity ?? 0);
  const nextQty = Math.min(stock, current + requested);

  // If no stock, remove existing line (if present) and return 0
  if (stock === 0 || nextQty <= 0) {
    if (existing) {
      await supabase.from("cart_items").delete().eq("id", existing.id);
    }
    return NextResponse.json({ ok: true, quantity: 0, stock });
  }

  // Upsert with clamped quantity (prevents duplicates)
  const { error: upsertErr } = await supabase
    .from("cart_items")
    .upsert([{ cart_id: cart.id, product_id: productId, quantity: nextQty }], {
      onConflict: "cart_id,product_id",
    });

  if (upsertErr) {
    return NextResponse.json(
      { ok: false, error: upsertErr.message },
      { status: 400 }
    );
  }

  // Include clamped quantity/stock in response (optional but useful for UI)
  return NextResponse.json({ ok: true, quantity: nextQty, stock });
}
