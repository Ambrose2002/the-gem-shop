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
      {/* Small admin bar (optional) */}
      <div className="mx-auto max-w-6xl px-4 pt-6 pb-2">
        <div className="flex items-center justify-end">
          <a href="/admin/signout" className="text-sm text-gray-600 underline">
            Sign out
          </a>
        </div>
      </div>
      {children}
    </div>
  );
}