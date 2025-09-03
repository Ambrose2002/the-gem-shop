// src/lib/supabase/server.ts
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function createClientServer() {
  const cookieStore = await cookies(); // ← await here

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          // In Server Components, cookies are read-only; ignore writes safely.
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            /* no-op in Server Component */
          }
        },
        remove(name: string, options: CookieOptions) {
          // In Server Components, cookies are read-only; ignore writes safely.
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            /* no-op in Server Component */
          }
        },
      },
    }
  );

  return supabase;
}