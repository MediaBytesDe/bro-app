"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Home, 
  ClipboardList, 
  Calendar, 
  FileText, 
  Users, 
  Settings,
  LogOut,
  Building2,
  ListTodo,
  Bell,
  CalendarClock,
  Package,
  CalendarDays
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface Props {
  partner: {
    id: string;
    company_name: string;
  };
  partnerUser: {
    id: string;
    display_name: string;
    email: string;
    role: string;
  };
  children: React.ReactNode;
}

export function PartnerShell({ partner, partnerUser, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const isAdmin = partnerUser.role === 'admin';
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);

  useEffect(() => {
    loadCounts();

    // Realtime für Notifications
    const notifChannel = supabase
      .channel("notifications_bell")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "notifications",
        filter: `recipient_id=eq.${partnerUser.id}`,
      }, () => loadCounts())
      .subscribe();

    // Realtime für Termin-Anfragen
    const reqChannel = supabase
      .channel("appointment_responses_bell")
      .on("postgres_changes", {
        event: "*",
        schema: "public", 
        table: "appointment_responses",
      }, () => loadCounts())
      .subscribe();

    return () => {
      supabase.removeChannel(notifChannel);
      supabase.removeChannel(reqChannel);
    };
  }, [partnerUser.id, partner.id]);

  async function loadCounts() {
    // Unread notifications
    const { count: notifCount } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("recipient_type", "partner_user")
      .eq("recipient_id", partnerUser.id)
      .is("read_at", null);

    setUnreadCount(notifCount || 0);

    // Pending appointment requests
    const { data: jobs } = await supabase
      .from("partner_jobs")
      .select("id")
      .eq("accepted_by_partner_id", partner.id);

    if (jobs && jobs.length > 0) {
      const jobIds = jobs.map(j => j.id);
      const { data: appointments } = await supabase
        .from("partner_job_appointments")
        .select("id")
        .in("job_id", jobIds);

      if (appointments && appointments.length > 0) {
        const { count: reqCount } = await supabase
          .from("appointment_responses")
          .select("*", { count: "exact", head: true })
          .in("partner_appointment_id", appointments.map(a => a.id))
          .eq("status", "pending");

        setPendingRequests(reqCount || 0);
      }
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const navItems = [
    { href: "/partner", icon: Home, label: "Dashboard", exact: true },
    { href: "/partner/auftraege", icon: ClipboardList, label: "Aufträge" },
    { href: "/partner/aufgaben", icon: ListTodo, label: "Aufgaben" },
    { href: "/partner/termin-anfragen", icon: CalendarClock, label: "Termin-Anfragen", badge: pendingRequests },
    { href: "/partner/kalender", icon: Calendar, label: "Kalender" },
    { href: "/partner/verfuegbarkeit", icon: CalendarDays, label: "Verfügbarkeit" },
    { href: "/partner/material", icon: Package, label: "Material" },
    ...(isAdmin ? [{ href: "/partner/rechnungen", icon: FileText, label: "Rechnungen" }] : []),
    ...(isAdmin ? [{ href: "/partner/team", icon: Users, label: "Team" }] : []),
    ...(isAdmin ? [{ href: "/partner/einstellungen", icon: Settings, label: "Einstellungen" }] : []),
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur border-b border-[#1a1a1a]">
        <div className="max-w-[1800px] mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/partner" className="flex items-center gap-3">
            <img src="/logo.png" alt="BROjekt" className="h-10" />
            <div>
              <span className="font-semibold text-white block">{partner.company_name}</span>
              <span className="text-xs text-neutral-500">Partner-Portal</span>
            </div>
          </Link>
          
          <div className="flex items-center gap-2">
            <Link
              href="/partner/benachrichtigungen"
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
              <p className="text-sm font-medium text-white">{partnerUser.display_name}</p>
              <p className="text-xs text-neutral-500">
                {isAdmin ? "Administrator" : "Mitarbeiter"}
              </p>
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

      {/* Navigation */}
      <nav className="border-b border-[#1a1a1a]">
        <div className="max-w-[1800px] mx-auto px-6">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide">
            {navItems.map((item) => (
              <NavLink 
                key={item.href}
                href={item.href} 
                icon={item.icon} 
                badge={(item as any).badge}
                active={item.exact 
                  ? pathname === item.href 
                  : pathname?.startsWith(item.href)
                }
              >
                {item.label}
              </NavLink>
            ))}
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
          <p>Partner von BROjekt GmbH · Sofort.Solar</p>
          <p className="mt-1">
            Support: <a href="tel:+4949719472940" className="text-[#fa432a] hover:underline">04971 9472940</a>
          </p>
        </div>
      </footer>
    </div>
  );
}

function NavLink({ href, icon: Icon, active, badge, children }: { 
  href: string; 
  icon: any; 
  active?: boolean;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 px-4 py-3 text-sm border-b-2 transition-colors whitespace-nowrap ${
        active 
          ? "text-white border-[#fa432a]" 
          : "text-neutral-400 hover:text-white border-transparent hover:border-[#fa432a]/50"
      }`}
    >
      <Icon className="w-4 h-4" />
      {children}
      {badge !== undefined && badge > 0 && (
        <span className="ml-1 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full px-1">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}
