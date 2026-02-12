"use client";

import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { Spinner } from "@/components/ui/spinner";
import { ErrorBoundary } from "@/components/error-boundary";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, loading, isCustomer } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else if (isCustomer) {
      router.replace("/portal");
    }
  }, [user, loading, isCustomer, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0a]">
        <Spinner />
      </div>
    );
  }

  if (!user || isCustomer) return null;

  return (
    <AppShell>
      <ErrorBoundary>{children}</ErrorBoundary>
    </AppShell>
  );
}
