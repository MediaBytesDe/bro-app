"use client";

import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { CustomerShell } from "@/components/customer-shell";
import { Spinner } from "@/components/ui/spinner";

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, loading, isCustomer, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else if (!isCustomer && !isAdmin) {
      router.replace("/");
    }
  }, [user, loading, isCustomer, isAdmin, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0a]">
        <Spinner />
      </div>
    );
  }

  if (!user || !profile) return null;

  return (
    <CustomerShell profile={{ ...profile, auth_id: user.id }}>
      {children}
    </CustomerShell>
  );
}
