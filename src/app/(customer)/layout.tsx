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

  // Check if user is a customer
  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role, display_name, email")
    .eq("auth_id", user.id)
    .eq("active", true)
    .single();

  // Not a customer - redirect to main app
  if (profileError || profile?.role !== "customer") {
    redirect("/");
  }

  return (
    <CustomerShell profile={profile}>
      {children}
    </CustomerShell>
  );
}
