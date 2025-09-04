"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClientBrowser } from "@/lib/supabase/client";
import { useCartUI } from "@/contexts/cart-ui";
import { useCart } from "@/contexts/cart-data";
import Image from "next/image";

export default function NavbarClient({
  initialUserName,
}: {
  initialUserName: string | null;
}) {
  const supabase = useMemo(() => createClientBrowser(), []);
  const router = useRouter();
  const pathname = usePathname();
  const { open } = useCartUI();
  const { totalQty } = useCart();
  const [userName, setUserName] = useState<string | null>(initialUserName);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(async (event) => {
      const {
        data: { user },
      } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
      const name =
        (user?.user_metadata?.name as string | undefined) ||
        (user?.user_metadata?.full_name as string | undefined) ||
        user?.email ||
        null;
      setUserName(name ?? null);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") router.refresh();
    });
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
    try {
      setSigningOut(true);
      await fetch("/api/auth/signout", { method: "POST" });
      setUserName(null);

      if (pathname?.startsWith("/admin")) {
        router.replace("/admin/login"); // kick out of protected area
      } else {
        router.refresh(); // re-read SSR with no session
      }
    } finally {
      setSigningOut(false);
    }
  }

  const showGreeting = userName && !pathname?.startsWith("/admin");

  return (
    <header className="sticky top-0 z-10 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-3">
          <a href="/" className="inline-flex items-center gap-3">
            <Image
              src="/brand/logo.png" // put your logo at public/brand/logo.png
              alt="The Gem Shop"
              width={36}
              height={36}
              className="h-9 w-9 rounded-full object-contain"
              priority
            />
            <span className="text-lg font-semibold">The Gem Shop</span>
          </a>
          {showGreeting && (
            <span className="ml-3 hidden text-sm text-gray-600 md:inline">
              Welcome, {userName.split(" ")[0]}
            </span>
          )}
        </div>

        <nav className="hidden gap-6 md:flex">
          <a className="hover:underline" href="/#shop">
            Shop
          </a>
          <a className="hover:underline" href="/#">
            About
          </a>
          <a className="hover:underline" href="/#">
            Contact
          </a>
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
