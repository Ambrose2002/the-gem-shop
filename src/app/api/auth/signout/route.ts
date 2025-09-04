// src/app/api/auth/signout/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function POST() {
  try {
    console.log("[api/auth/signout] Starting server signout...");
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
              try {
                jar.set({ name, value, ...options });
              } catch (error) {
                console.warn("[api/auth/signout] Failed to set cookie:", name, error);
              }
            });
          },
        },
      }
    );

    // Clears server-side auth cookies
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.warn("[api/auth/signout] Supabase signout error:", error);
    } else {
      console.log("[api/auth/signout] Supabase signout successful");
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/auth/signout] Unexpected error:", error);
    return NextResponse.json({ ok: false, error: "Signout failed" }, { status: 500 });
  }
}