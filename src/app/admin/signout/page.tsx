"use client";
import { createClientBrowser } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

export default function AdminSignOut() {
  const supabase = useMemo(() => createClientBrowser(), []);
  const router = useRouter();
  useEffect(() => {
    (async () => {
      await supabase.auth.signOut();
      router.replace("/admin/login");
    })();
  }, []);
  return null;
}