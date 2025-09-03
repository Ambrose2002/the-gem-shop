import { createClientServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClientServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { data: isAdmin } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!isAdmin) redirect("/admin/login");

  // Consistent light background; RootLayout handles Navbar/Footer and page height
  return (
    <div className="bg-gray-50">
      
      {children}
    </div>
  );
}