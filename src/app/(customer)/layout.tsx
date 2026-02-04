import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CustomerShell } from "@/components/customer-shell";

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check if user is a customer or admin (admin can preview)
  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role, display_name, email, auth_id")
    .eq("auth_id", user.id)
    .eq("active", true)
    .single();

  // Not a customer or admin - redirect to main app
  const allowedRoles = ["customer", "admin", "superadmin"];
  if (profileError || !allowedRoles.includes(profile?.role)) {
    redirect("/");
  }

  return (
    <CustomerShell profile={{ ...profile, auth_id: user.id, role: profile.role }}>
      {children}
    </CustomerShell>
  );
}
