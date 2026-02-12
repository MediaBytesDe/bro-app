import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PartnerShell } from "@/components/partner-shell";

export default async function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Find partner_user by auth_user_id
  const { data: partnerUser, error: partnerError } = await supabase
    .from("partner_users")
    .select(`
      id,
      display_name,
      email,
      role,
      active,
      partner:partners (
        id,
        company_name,
        active
      )
    `)
    .eq("auth_user_id", user.id)
    .single();

  // Not a partner user - redirect
  if (partnerError || !partnerUser) {
    redirect("/");
  }

  // Partner or user inactive
  if (!partnerUser.active || !partnerUser.partner?.active) {
    redirect("/login?error=inactive");
  }

  return (
    <PartnerShell 
      partner={partnerUser.partner}
      partnerUser={partnerUser}
    >
      {children}
    </PartnerShell>
  );
}
