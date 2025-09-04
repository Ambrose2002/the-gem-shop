"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClientBrowser } from "@/lib/supabase/client";
import { useCartUI } from "@/contexts/cart-ui";
import { useCart } from "@/contexts/cart-data";
import Image from "next/image";
import Link from "next/link";

export default function NavbarClient({
  initialUserName,
}: {
  initialUserName: string | null;
}) {
  const supabase = useMemo(() => createClientBrowser(), []);
  const router = useRouter();
  const pathname = usePathname();
  const { open } = useCartUI();
  const { totalQty, clear } = useCart();
  const [userName, setUserName] = useState<string | null>(initialUserName);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("[navbar] Auth state changed:", event);

        if (event === "SIGNED_OUT") {
          console.log("[navbar] User signed out, clearing state...");
          setUserName(null);
          setSigningOut(false);
          clear();
          router.refresh();
          return;
        }

        if (event === "SIGNED_IN" && session?.user) {
          console.log("[navbar] User signed in");
          const user = session.user;
          const name =
            (user.user_metadata?.name as string | undefined) ||
            (user.user_metadata?.full_name as string | undefined) ||
            user.email ||
            null;
          setUserName(name);
          router.refresh();
          return;
        }

        // For other events, just get current user state
        if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
          const {
            data: { user },
          } = await supabase.auth
            .getUser()
            .catch(() => ({ data: { user: null } }));

          if (user) {
            const name =
              (user.user_metadata?.name as string | undefined) ||
              (user.user_metadata?.full_name as string | undefined) ||
              user.email ||
              null;
            setUserName(name);
          } else {
            setUserName(null);
          }
        }
      }
    );

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []); // no deps to avoid loops

  async function signInWithGoogle() {
    const origin = window.location.origin;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) return alert(error.message);
    if (data?.url) window.location.href = data.url;
  }
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    if (signingOut) return; // Prevent double-clicks
    setSigningOut(true);

    try {
      console.log("[signout] Starting signout process...");

      // 1) Client session: end it (triggers SIGNED_OUT for listeners)
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        console.warn("[signout] Client signout error:", signOutError);
      } else {
        console.log("[signout] Client signout successful");
      }

      // 2) Server cookies: clear server-side session (with timeout)
      console.log("[signout] Clearing server cookies...");
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout

        const response = await fetch("/api/auth/signout", {
          method: "POST",
          credentials: "include",
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          console.log("[signout] Server signout successful");
        } else {
          console.warn("[signout] Server signout failed:", response.status);
        }
      } catch (fetchError: any) {
        if (fetchError.name === "AbortError") {
          console.warn("[signout] Server signout timed out");
        } else {
          console.warn("[signout] Server signout error:", fetchError);
        }
      }

      // 3) Clear local state immediately
      console.log("[signout] Clearing local state...");
      clear();
      setUserName(null);

      // 4) Navigate to home (soft navigation first, then hard reload if needed)
      console.log("[signout] Redirecting to home...");
      if (pathname?.startsWith("/admin")) {
        router.push("/admin/login");
      } else {
        router.push("/");
      }
      router.refresh();
    } catch (error) {
      console.error("[signout] Unexpected error:", error);
      // Even if there's an error, try to clear local state
      clear();
      setUserName(null);
      if (pathname?.startsWith("/admin")) {
        router.push("/admin/login");
      } else {
        router.push("/");
      }
    }
  }

  const showGreeting = userName && !pathname?.startsWith("/admin");

  return (
    <header className="sticky top-0 z-10 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="inline-flex items-center gap-3">
            <Image
              src="/brand/logo.png" // put your logo at public/brand/logo.png
              alt="The Gem Shop"
              width={36}
              height={36}
              className="h-9 w-9 rounded-full object-contain"
              priority
            />
            <span className="text-lg font-semibold">The Gem Shop</span>
          </Link>
          {showGreeting && (
            <span className="ml-3 hidden text-sm text-gray-600 md:inline">
              Welcome, {userName.split(" ")[0]}
            </span>
          )}
        </div>

        <nav className="hidden gap-6 md:flex">
          <Link className="hover:underline" href="/#shop">
            Shop
          </Link>
          <Link className="hover:underline" href="/about">
            About
          </Link>
          <Link className="hover:underline" href="/contact">
            Contact
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={open}
            className="relative rounded-xl border border-gray-300 px-4 py-2 hover:bg-gray-100"
            aria-label="Open cart"
          >
            Cart
            {totalQty > 0 && (
              <span
                className="absolute -top-2 -right-2 inline-flex min-w-[1.25rem] items-center justify-center
                rounded-full bg-black px-1.5 py-0.5 text-xs font-semibold text-white"
              >
                {totalQty}
              </span>
            )}
          </button>

          {userName ? (
            <button
              onClick={signOut}
              disabled={signingOut}
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50"
              title={userName}
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm hover:bg-gray-100"
            >
              Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
