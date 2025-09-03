// src/app/api/admin/products/[id]/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/** Make a SSR supabase client with Next cookies (new getAll/setAll API) */
async function makeClient() {
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return jar.getAll();
        },
        setAll(list) {
          list.forEach(({ name, value, options }) => {
            jar.set({ name, value, ...options });
          });
        },
      },
    }
  );
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const { id } = ctx.params;
  const body = await req.json();
  const supabase = await makeClient();

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

  // 2) Sync categories (optional arrays)
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

/**
 * DELETE /api/admin/products/:id
 * - Soft delete (default): sets deleted_at/by/reason and keeps data
 *   → /api/admin/products/:id            (DELETE)
 *   → /api/admin/products/:id?reason=... (DELETE)
 * - Hard delete: removes storage files + related rows + product
 *   → /api/admin/products/:id?hard=1     (DELETE)
 */
export async function DELETE(req: Request, ctx: { params: { id: string } }) {
  const supabase = await makeClient();
  const { id } = ctx.params;

  const url = new URL(req.url);
  const hard = url.searchParams.get("hard") === "1";
  const reason = url.searchParams.get("reason") || null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  if (!hard) {
    // SOFT DELETE: mark as deleted
    const { error } = await supabase
      .from("products")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: user.id,
        deleted_reason: reason,
      })
      .eq("id", id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, soft: true });
  }

  // HARD DELETE: remove storage files + related rows + product
  const bucket = "product-images";
  const folder = id;

  // 1) List and remove objects in product folder
  const { data: entries, error: listErr } = await supabase.storage
    .from(bucket)
    .list(folder, { limit: 1000 });
  if (listErr) return NextResponse.json({ ok: false, error: listErr.message }, { status: 400 });

  if (entries && entries.length) {
    const keys = entries.map((e) => `${folder}/${e.name}`);
    const { error: rmErr } = await supabase.storage.from(bucket).remove(keys);
    if (rmErr) return NextResponse.json({ ok: false, error: rmErr.message }, { status: 400 });
  }

  // 2) Delete related rows (if you added ON DELETE CASCADE FKs, this can be skipped)
  await supabase.from("product_images").delete().eq("product_id", id);
  await supabase.from("product_categories").delete().eq("product_id", id);
  await supabase.from("cart_items").delete().eq("product_id", id);

  // 3) Delete the product
  const { error: delErr } = await supabase.from("products").delete().eq("id", id);
  if (delErr) return NextResponse.json({ ok: false, error: delErr.message }, { status: 400 });

  return NextResponse.json({ ok: true, hard: true });
}