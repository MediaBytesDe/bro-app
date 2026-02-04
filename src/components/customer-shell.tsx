"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, FolderOpen, FileText, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface Props {
  profile: {
    display_name: string | null;
    email: string | null;
  };
  children: React.ReactNode;
}

export function CustomerShell({ profile, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur border-b border-[#1a1a1a]">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/portal" className="flex items-center gap-3">
            <img src="/logo.png" alt="BROjekt" className="h-8" />
            <span className="font-semibold text-white">Kundenportal</span>
          </Link>
          
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
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

      {/* Navigation */}
      <nav className="border-b border-[#1a1a1a]">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex gap-1">
            <NavLink href="/portal" icon={Home} active={pathname === "/portal"}>
              Übersicht
            </NavLink>
            <NavLink href="/portal/projekte" icon={FolderOpen} active={pathname?.startsWith("/portal/projekte")}>
              Meine Projekte
            </NavLink>
            <NavLink href="/portal/angebote" icon={FileText} active={pathname === "/portal/angebote"}>
              Angebote
            </NavLink>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1a1a1a] py-6 mt-12">
        <div className="max-w-5xl mx-auto px-4 text-center text-sm text-neutral-500">
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
