import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check if user is a customer - redirect to portal
  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role")
    .eq("auth_id", user.id)
    .eq("active", true)
    .single();

  // Only redirect if we confirmed user is a customer
  if (!profileError && profile?.role === "customer") {
    redirect("/portal");
  }

  return <AppShell user={user}>{children}</AppShell>;
}
