import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function POST(req: Request) {
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

  const body = await req
    .json()
    .catch(() => ({ lines: [] as { productId: string; quantity: number }[] }));
  const local: { productId: string; quantity: number }[] = body.lines || [];

  // ensure cart
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
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    cart = newCart;
  }

  // load existing items & merge (pre-clamp)
  const { data: existing } = await supabase
    .from("cart_items")
    .select("product_id, quantity")
    .eq("cart_id", cart.id);

  const qty = new Map<string, number>();
  (existing ?? []).forEach((r) => qty.set(r.product_id, r.quantity));
  local.forEach((l) =>
    qty.set(l.productId, Math.min(99, (qty.get(l.productId) ?? 0) + Math.max(0, Number(l.quantity) || 0)))
  );

  // ⬇️ NEW: clamp to product stock
  const productIds = Array.from(qty.keys());
  if (productIds.length) {
    // also ignore soft-deleted products if you use deleted_at
    const { data: stocks, error: stockErr } = await supabase
      .from("products")
      .select("id, stock, deleted_at")
      .in("id", productIds);
    if (stockErr) return NextResponse.json({ ok: false, error: stockErr.message }, { status: 500 });

    const stockById = new Map<string, { stock: number; deleted: boolean }>(
      (stocks ?? []).map((r) => [r.id as string, { stock: Math.max(0, Number(r.stock) || 0), deleted: !!r.deleted_at }])
    );

    for (const pid of productIds) {
      const entry = stockById.get(pid);
      if (!entry || entry.deleted) {
        // product missing or soft-deleted: drop it
        qty.delete(pid);
        continue;
      }
      const clamped = Math.min(entry.stock, qty.get(pid) ?? 0);
      if (clamped > 0) qty.set(pid, clamped);
      else qty.delete(pid);
    }
  }

  // replace snapshot (simple & safe)
  await supabase.from("cart_items").delete().eq("cart_id", cart.id);
  const rows = Array.from(qty.entries()).map(([pid, q]) => ({
    cart_id: cart.id,
    product_id: pid,
    quantity: q,
  }));
  if (rows.length) {
    const { error: insErr } = await supabase.from("cart_items").insert(rows);
    if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}