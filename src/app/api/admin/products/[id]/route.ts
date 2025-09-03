import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const { id } = ctx.params;
  const body = await req.json();

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set(name: string, value: string, options: CookieOptions) { cookieStore.set({ name, value, ...options }); },
        remove(name: string, options: CookieOptions) { cookieStore.set({ name, value: "", ...options }); },
      },
    }
  );

  // 1) Update core fields
  const { error: updErr } = await supabase
    .from("products")
    .update({
      title: body.title,
      description: body.description,
      price_cents: body.price_cents,
      stock: body.stock,
      status: body.status,
    })
    .eq("id", id);
  if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 400 });

  // 2) Sync categories (add/remove arrays are optional)
  if (Array.isArray(body.removeCategoryIds) && body.removeCategoryIds.length) {
    const { error } = await supabase
      .from("product_categories")
      .delete()
      .eq("product_id", id)
      .in("category_id", body.removeCategoryIds);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
  if (Array.isArray(body.addCategoryIds) && body.addCategoryIds.length) {
    const rows = body.addCategoryIds.map((cid: string) => ({ product_id: id, category_id: cid }));
    const { error } = await supabase.from("product_categories").insert(rows);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}