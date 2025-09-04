// SERVER COMPONENT
export const dynamic = "force-dynamic";   // ✅ ensure no stale cache
export const revalidate = 0;              // ✅ belt & suspenders

import NavbarClient from "./NavbarClient";
import { createClientServer } from "@/lib/supabase/server";

export default async function Navbar() {
  const supabase = await createClientServer();
  const { data: { user } } = await supabase.auth.getUser();

  const initialUserName =
    (user?.user_metadata?.name as string | undefined) ||
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email ||
    null;

  return <NavbarClient initialUserName={initialUserName} />;
}