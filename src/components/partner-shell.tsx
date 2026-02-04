"use client";

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
  Building2
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

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const navItems = [
    { href: "/partner", icon: Home, label: "Dashboard", exact: true },
    { href: "/partner/auftraege", icon: ClipboardList, label: "Aufträge" },
    { href: "/partner/kalender", icon: Calendar, label: "Kalender" },
    { href: "/partner/rechnungen", icon: FileText, label: "Rechnungen" },
    ...(isAdmin ? [{ href: "/partner/team", icon: Users, label: "Team" }] : []),
    ...(isAdmin ? [{ href: "/partner/einstellungen", icon: Settings, label: "Einstellungen" }] : []),
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur border-b border-[#1a1a1a]">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/partner" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-semibold text-white block">{partner.company_name}</span>
              <span className="text-xs text-neutral-500">Partner-Portal</span>
            </div>
          </Link>
          
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
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
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide">
            {navItems.map((item) => (
              <NavLink 
                key={item.href}
                href={item.href} 
                icon={item.icon} 
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
      <main className="max-w-6xl mx-auto px-4 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1a1a1a] py-6 mt-12">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-neutral-500">
          <p>Partner von BROjekt GmbH · Sofort.Solar</p>
          <p className="mt-1">
            Support: <a href="tel:+4949719472940" className="text-blue-400 hover:underline">04971 9472940</a>
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
      className={`flex items-center gap-2 px-4 py-3 text-sm border-b-2 transition-colors whitespace-nowrap ${
        active 
          ? "text-white border-blue-500" 
          : "text-neutral-400 hover:text-white border-transparent hover:border-blue-500/50"
      }`}
    >
      <Icon className="w-4 h-4" />
      {children}
    </Link>
  );
}
