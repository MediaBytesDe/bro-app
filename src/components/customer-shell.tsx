"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Home, FolderOpen, FileText, LogOut, Calendar, Files, MessageSquare, CreditCard, Bell, Eye, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface Props {
  profile: {
    display_name: string | null;
    email: string | null;
    auth_id?: string;
    role?: string;
  };
  children: React.ReactNode;
}

export function CustomerShell({ profile, children }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Check for impersonation
  const impersonateId = searchParams.get("impersonate");
  const isAdmin = profile?.role === "admin" || profile?.role === "superadmin";
  const isImpersonating = isAdmin && !!impersonateId;
  const impersonateQuery = isImpersonating ? `?impersonate=${impersonateId}` : "";

  useEffect(() => {
    loadCustomerAndNotifications();
  }, [profile?.auth_id, impersonateId]);

  useEffect(() => {
    if (!customerId) return;

    // Realtime subscription
    const channel = supabase
      .channel("customer_notifications")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "notifications",
        filter: `recipient_id=eq.${customerId}`,
      }, () => loadNotificationCount())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [customerId]);

  async function loadCustomerAndNotifications() {
    if (!profile?.auth_id) return;

    if (isImpersonating && impersonateId) {
      // Admin impersonating - load impersonated customer's data
      const { data: customer } = await supabase
        .from("customers")
        .select("id, first_name, last_name, company_name")
        .eq("id", impersonateId)
        .single();

      if (customer) {
        setCustomerId(customer.id);
        setCustomerName(customer.company_name || `${customer.first_name} ${customer.last_name}`);
        loadNotificationCount(customer.id);
      }
    } else {
      // Normal customer
      const { data: customer } = await supabase
        .from("customers")
        .select("id, first_name, last_name, company_name")
        .eq("auth_user_id", profile.auth_id)
        .single();

      if (customer) {
        setCustomerId(customer.id);
        setCustomerName(customer.company_name || `${customer.first_name} ${customer.last_name}`);
        loadNotificationCount(customer.id);
      }
    }
  }

  async function loadNotificationCount(cId?: string) {
    const id = cId || customerId;
    if (!id) return;

    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("recipient_type", "customer")
      .eq("recipient_id", id)
      .is("read_at", null);

    setUnreadCount(count || 0);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur border-b border-[#1a1a1a]">
        <div className="max-w-[1800px] mx-auto px-6 h-16 flex items-center justify-between">
          <Link href={`/portal${impersonateQuery}`} className="flex items-center gap-3">
            <img src="/logo.png" alt="BROjekt" className="h-8" />
            <span className="font-semibold text-white">Kundenportal</span>
          </Link>
          
          <div className="flex items-center gap-2">
            <Link
              href={`/portal/benachrichtigungen${impersonateQuery}`}
              className="relative p-2 text-neutral-400 hover:text-white transition-colors"
              title="Benachrichtigungen"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full px-1">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Link>
            <div className="text-right hidden sm:block ml-2">
              <p className="text-sm font-medium text-white">{profile?.display_name || "Kunde"}</p>
              <p className="text-xs text-neutral-500">{profile?.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="p-2 text-neutral-400 hover:text-white transition-colors"
              title="Abmelden"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Admin Impersonation Banner */}
      {isImpersonating && (
        <div className="bg-blue-600 text-white">
          <div className="max-w-[1800px] mx-auto px-6 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              <span className="text-sm">
                <strong>Admin-Ansicht</strong> – Du siehst das Portal als: <strong>{customerName}</strong>
              </span>
            </div>
            <button
              onClick={() => window.close()}
              className="p-1 hover:bg-blue-500 rounded"
              title="Fenster schließen"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="border-b border-[#1a1a1a]">
        <div className="max-w-[1800px] mx-auto px-6">
          <div className="flex gap-1 overflow-x-auto">
            <NavLink href={`/portal${impersonateQuery}`} icon={Home} active={pathname === "/portal"}>
              Übersicht
            </NavLink>
            <NavLink href={`/portal/projekte${impersonateQuery}`} icon={FolderOpen} active={pathname?.startsWith("/portal/projekte")}>
              Meine Projekte
            </NavLink>
            <NavLink href={`/portal/angebote${impersonateQuery}`} icon={FileText} active={pathname === "/portal/angebote"}>
              Angebote
            </NavLink>
            <NavLink href={`/portal/termine${impersonateQuery}`} icon={Calendar} active={pathname === "/portal/termine"}>
              Termine
            </NavLink>
            <NavLink href={`/portal/dokumente${impersonateQuery}`} icon={Files} active={pathname === "/portal/dokumente"}>
              Dokumente
            </NavLink>
            <NavLink href={`/portal/nachrichten${impersonateQuery}`} icon={MessageSquare} active={pathname?.startsWith("/portal/nachrichten")}>
              Nachrichten
            </NavLink>
            <NavLink href={`/portal/zahlungen${impersonateQuery}`} icon={CreditCard} active={pathname === "/portal/zahlungen"}>
              Zahlungen
            </NavLink>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-[1800px] mx-auto px-6 py-6 flex-1 w-full">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1a1a1a] py-6 mt-auto">
        <div className="max-w-[1800px] mx-auto px-6 text-center text-sm text-neutral-500">
          <p>© {new Date().getFullYear()} BROjekt GmbH</p>
          <p className="mt-1">
            Bei Fragen: <a href="mailto:info@brojekt.gmbh" className="text-[#fa432a] hover:underline">info@brojekt.gmbh</a>
          </p>
        </div>
      </footer>
    </div>
  );
}

function NavLink({ href, icon: Icon, active, children }: { 
  href: string; 
  icon: any; 
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 px-4 py-3 text-sm border-b-2 transition-colors ${
        active 
          ? "text-white border-[#fa432a]" 
          : "text-neutral-400 hover:text-white border-transparent hover:border-[#fa432a]/50"
      }`}
    >
      <Icon className="w-4 h-4" />
      {children}
    </Link>
  );
}
