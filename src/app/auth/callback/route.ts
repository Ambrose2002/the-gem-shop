// src/app/auth/callback/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = url.searchParams.get("next") ?? "/";
  const code = url.searchParams.get("code");        // 👈 read the auth code

  // If no code, just bounce home (or add an error query)
  if (!code) {
    return NextResponse.redirect(new URL("/", url.origin));
  }

  const jar = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return jar.getAll(); // [{ name, value, ... }]
        },
        setAll(list) {
          list.forEach(({ name, value, options }) => {
            jar.set({ name, value, ...options }); // Route Handler can write cookies
          });
        },
      },
    }
  );

  // Exchange the provided ?code=... for a session and set cookies
  await supabase.auth.exchangeCodeForSession(code); // 👈 pass the code explicitly

  return NextResponse.redirect(new URL(next, url.origin));
}