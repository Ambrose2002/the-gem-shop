import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function DELETE(_: Request, ctx: { params: { productId: string } }) {
  const { productId } = ctx.params;

  const jar = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return jar.getAll(); // returns { name, value }[]
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
  if (!cart) return NextResponse.json({ ok: true }); // nothing to delete

  await supabase.from("cart_items").delete().eq("cart_id", cart.id).eq("product_id", productId);
  return NextResponse.json({ ok: true });
}