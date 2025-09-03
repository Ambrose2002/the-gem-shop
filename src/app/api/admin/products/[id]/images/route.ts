import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

function makeSafeObjectKey(originalName: string) {
  const dot = originalName.lastIndexOf(".");
  const ext = dot >= 0 ? originalName.slice(dot + 1).toLowerCase() : "";
  const base = dot >= 0 ? originalName.slice(0, dot) : originalName;
  const normalized = base.normalize("NFKD").replace(/[^\w\-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  const stamp = Date.now();
  return `${stamp}-${normalized || "file"}${ext ? "." + ext : ""}`;
}

export async function POST(req: Request, ctx: { params: { id: string } }) {
  const { id } = ctx.params;
  const form = await req.formData();
  const files = form.getAll("files") as File[];

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

  // find current max sort
  let nextSort = -1;
  {
    const { data } = await supabase
      .from("product_images")
      .select("sort")
      .eq("product_id", id)
      .order("sort", { ascending: false })
      .limit(1);
    nextSort = ((data?.[0]?.sort ?? -1) as number) + 1;
  }

  const bucket = "product-images";
  for (const file of files) {
    const arrayBuf = await file.arrayBuffer();
    const safe = makeSafeObjectKey(file.name);
    const objectKey = `${id}/${safe}`;

    const { error: upErr } = await supabase.storage
      .from(bucket)
      .upload(objectKey, new Uint8Array(arrayBuf), {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined,
      });
    if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 400 });

    const { data: pub } = await supabase.storage.from(bucket).getPublicUrl(objectKey);
    const { error: insErr } = await supabase.from("product_images").insert({
      product_id: id, url: pub.publicUrl, sort: nextSort++,
    });
    if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}