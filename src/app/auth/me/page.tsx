import { createClientServer } from "@/lib/supabase/server";

export default async function Me() {
  const supabase = await createClientServer();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <pre className="mx-auto max-w-3xl p-6 bg-white rounded-xl border">
      {JSON.stringify(user, null, 2)}
    </pre>
  );
}