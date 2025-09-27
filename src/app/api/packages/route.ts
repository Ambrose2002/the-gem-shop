import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

type PackageProduct = {
  id: string;
  title: string;
  description: string;
  price_cents: number;
  stock: number;
  images: string[];
};

type ApiResponse =
  | { ok: true; packages: PackageProduct[] }
  | { ok: false; error: string };

export async function GET() {
  const jar = await cookies();
  const supabase = createServerClient(
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

  const { data: category, error: catErr } = await supabase
    .from("categories")
    .select("id")
    .ilike("name", "package")
    .maybeSingle();

  if (catErr) {
    return NextResponse.json(
      { ok: false, error: catErr.message } satisfies ApiResponse,
      { status: 500 }
    );
  }

  if (!category) {
    return NextResponse.json({ ok: true, packages: [] } satisfies ApiResponse);
  }

  const { data: productLinks, error: linkErr } = await supabase
    .from("product_categories")
    .select("product_id")
    .eq("category_id", category.id);

  if (linkErr) {
    return NextResponse.json(
      { ok: false, error: linkErr.message } satisfies ApiResponse,
      { status: 500 }
    );
  }

  const productIds = [
    ...new Set((productLinks ?? []).map((link) => link.product_id as string)),
  ];

  if (productIds.length === 0) {
    return NextResponse.json({ ok: true, packages: [] } satisfies ApiResponse);
  }

  const { data: packageProducts, error: prodErr } = await supabase
    .from("products")
    .select("id, title, description, price_cents, stock, status, deleted_at")
    .in("id", productIds);

  if (prodErr) {
    return NextResponse.json(
      { ok: false, error: prodErr.message } satisfies ApiResponse,
      { status: 500 }
    );
  }

  const activePackages = (packageProducts ?? []).filter(
    (p) => p.status === "published" && !p.deleted_at
  );

  if (activePackages.length === 0) {
    return NextResponse.json({ ok: true, packages: [] } satisfies ApiResponse);
  }

  const { data: images, error: imgErr } = await supabase
    .from("product_images")
    .select("product_id, url, sort")
    .in(
      "product_id",
      activePackages.map((p) => p.id)
    )
    .order("sort", { ascending: true });

  if (imgErr) {
    return NextResponse.json(
      { ok: false, error: imgErr.message } satisfies ApiResponse,
      { status: 500 }
    );
  }

  const imagesByProduct = new Map<string, string[]>();
  (images ?? []).forEach((img) => {
    const list = imagesByProduct.get(img.product_id) ?? [];
    list.push(img.url);
    imagesByProduct.set(img.product_id, list);
  });

  const payload: PackageProduct[] = activePackages.map((pkg) => ({
    id: pkg.id,
    title: (pkg.title as string) ?? "",
    description: (pkg.description as string) ?? "",
    price_cents: Number(pkg.price_cents ?? 0),
    stock: Number(pkg.stock ?? 0),
    images: imagesByProduct.get(pkg.id) ?? [],
  }));

  return NextResponse.json({ ok: true, packages: payload } satisfies ApiResponse);
}
