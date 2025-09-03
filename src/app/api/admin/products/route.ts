import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/** Make SSR Supabase (new getAll/setAll cookie API) */
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

function baseSlugFromTitle(title: string) {
  return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
}

async function ensureUniqueSlug(supabase: any, baseSlug: string) {
  const { data, error } = await supabase.from("products").select("slug").ilike("slug", `${baseSlug}%`);
  if (error || !data) return baseSlug;
  const set = new Set(data.map((r: any) => r.slug));
  if (!set.has(baseSlug)) return baseSlug;
  for (let i = 2; i < 200; i++) {
    const cand = `${baseSlug}-${i}`;
    if (!set.has(cand)) return cand;
  }
  return `${baseSlug}-${Date.now()}`;
}

function makeSafeObjectKey(originalName: string) {
  const dot = originalName.lastIndexOf(".");
  const ext = dot >= 0 ? originalName.slice(dot + 1).toLowerCase() : "";
  const base = dot >= 0 ? originalName.slice(0, dot) : originalName;
  const normalized = base
    .normalize("NFKD")
    .replace(/[^\w\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  const stamp = Date.now();
  return `${stamp}-${normalized || "file"}${ext ? "." + ext : ""}`;
}

export async function POST(req: Request) {
  const supabase = await makeClient();

  // must be authenticated (RLS + admin area)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  // Accept multipart or JSON. We’ll use multipart from the client.
  const form = await req.formData().catch(() => null);
  const body =
    form
      ? {
          title: String(form.get("title") || ""),
          description: String(form.get("description") || ""),
          price_cents: Number(form.get("price_cents") || 0),
          stock: Number(form.get("stock") || 0),
          status: String(form.get("status") || "published"),
          category_ids: JSON.parse(String(form.get("category_ids") || "[]")) as string[],
          files: form.getAll("files") as File[],
        }
      : await req.json();

  const title = (body.title || "").trim();
  if (!title) return NextResponse.json({ ok: false, error: "Title is required" }, { status: 400 });

  const price_cents = Math.max(0, Math.round(Number(body.price_cents) || 0));
  const stock = Math.max(0, Number(body.stock) || 0);
  const status = body.status === "draft" ? "draft" : "published";
  const categoryIds: string[] = Array.isArray(body.category_ids) ? body.category_ids : [];

  // 1) slug
  const base = baseSlugFromTitle(title);
  const slug = await ensureUniqueSlug(supabase, base);

  // 2) insert product
  const { data: product, error: insErr } = await supabase
    .from("products")
    .insert({ title, slug, description: body.description || "", price_cents, stock, status })
    .select("id")
    .single();
  if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 400 });

  // 3) categories
  if (categoryIds.length) {
    const rows = categoryIds.map((cid) => ({ product_id: product.id, category_id: cid }));
    const { error: pcErr } = await supabase.from("product_categories").insert(rows);
    if (pcErr) return NextResponse.json({ ok: false, error: pcErr.message }, { status: 400 });
  }

  // 4) images
  const files: File[] = (body.files || []) as File[];
  const bucket = "product-images";
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const safe = makeSafeObjectKey(file.name);
    const key = `${product.id}/${safe}`;

    const arrayBuf = await file.arrayBuffer();
    const { error: upErr } = await supabase.storage
      .from(bucket)
      .upload(key, new Uint8Array(arrayBuf), {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined,
      });
    if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 400 });

    const { data: pub } = await supabase.storage.from(bucket).getPublicUrl(key);
    const { error: imgErr } = await supabase
      .from("product_images")
      .insert({ product_id: product.id, url: pub.publicUrl, sort: i });
    if (imgErr) return NextResponse.json({ ok: false, error: imgErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: product.id });
}