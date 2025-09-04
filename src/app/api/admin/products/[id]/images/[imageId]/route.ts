import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

function getObjectKeyFromPublicUrl(url: string) {
  const noQuery = url.split("?")[0];
  const idx = noQuery.indexOf("/storage/v1/object/public/product-images/");
  if (idx === -1) return null;
  return noQuery.slice(idx + "/storage/v1/object/public/product-images/".length);
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string; imageId: string }> }) {
  const { imageId } = await ctx.params;

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

  // 1) Lookup row to get its URL
  const { data: row, error: selErr } = await supabase
    .from("product_images")
    .select("id, url")
    .eq("id", imageId)
    .maybeSingle();
  if (selErr) return NextResponse.json({ ok: false, error: selErr.message }, { status: 400 });
  if (!row) return NextResponse.json({ ok: false, error: "Image not found" }, { status: 404 });

  const key = getObjectKeyFromPublicUrl(row.url);
  if (!key) return NextResponse.json({ ok: false, error: "Invalid public URL" }, { status: 400 });

  // 2) Remove from storage
  const { error: rmErr } = await supabase.storage.from("product-images").remove([key]);
  if (rmErr) return NextResponse.json({ ok: false, error: rmErr.message }, { status: 400 });

  // 3) Remove DB row
  const { error: delErr } = await supabase.from("product_images").delete().eq("id", imageId);
  if (delErr) return NextResponse.json({ ok: false, error: delErr.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}