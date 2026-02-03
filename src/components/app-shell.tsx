"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Bot, Home, Users, Brain, FileText, LogOut, Building2, FileSignature, Calendar, Wrench, FolderOpen, Cpu, ClipboardList, MoreHorizontal, X } from "lucide-react";
import type { User as AuthUser } from "@supabase/supabase-js";

// All tabs for desktop
const allTabs = [
  { id: "dashboard", path: "/", label: "Dashboard", icon: Home },
  { id: "customers", path: "/customers", label: "Kunden", icon: Building2 },
  { id: "leads", path: "/leads", label: "Leads", icon: Users },
  { id: "quotes", path: "/quotes", label: "Angebote", icon: FileSignature },
  { id: "calendar", path: "/calendar", label: "Kalender", icon: Calendar },
  { id: "forms", path: "/forms", label: "Formulare", icon: ClipboardList },
  { id: "subcontractors", path: "/subcontractors", label: "Subuntern.", icon: Wrench },
  { id: "documents", path: "/documents", label: "Dokumente", icon: FolderOpen },
  { id: "skills", path: "/skills", label: "Skills", icon: Brain },
  { id: "logs", path: "/logs", label: "Logs", icon: FileText },
  { id: "openclaw", path: "/openclaw", label: "OpenClaw", icon: Cpu },
];

// Mobile: 4 main tabs + "Mehr" menu
const mobileMainTabs = allTabs.slice(0, 4); // Dashboard, Kunden, Leads, Angebote
const mobileMoreTabs = allTabs.slice(4); // Rest in "Mehr" menu

interface AppShellProps {
  user: AuthUser;
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };

  // Check if current path is in "more" section
  const isInMoreSection = mobileMoreTabs.some((tab) => isActive(tab.path));

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function handleMoreTabClick(path: string) {
    router.push(path);
    setMoreMenuOpen(false);
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#0a0a0a]/95 backdrop-blur-sm border-b border-[#1a1a1a]">
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-semibold text-white">Bro</span>
          </div>

          {/* Desktop Tabs */}
          <nav className="hidden md:flex items-center gap-1">
            {allTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => router.push(tab.path)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  isActive(tab.path)
                    ? "bg-gradient-to-r from-red-500/20 to-orange-500/20 text-orange-400"
                    : "text-neutral-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>

          <button
            onClick={handleLogout}
            className="p-2 rounded-lg text-neutral-500 hover:text-white hover:bg-white/5 transition-colors"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-3 py-4 pb-24 md:pb-4">{children}</main>

      {/* Mobile "More" Menu Overlay */}
      {moreMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMoreMenuOpen(false)}
        >
          <div 
            className="absolute bottom-20 left-3 right-3 bg-[#111] border border-[#262626] rounded-2xl p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid grid-cols-4 gap-1">
              {mobileMoreTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleMoreTabClick(tab.path)}
                  className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl transition-all min-h-[72px] ${
                    isActive(tab.path) 
                      ? "bg-gradient-to-br from-red-500/20 to-orange-500/20 text-orange-400" 
                      : "text-neutral-400 active:bg-white/5"
                  }`}
                >
                  <tab.icon className="w-6 h-6" />
                  <span className="text-[11px] font-medium text-center leading-tight">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Nav - 5 items: 4 main + More */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0d0d0d]/95 backdrop-blur-sm border-t border-[#1a1a1a] md:hidden safe-area-bottom z-50">
        <div className="flex items-center justify-around py-2 px-1">
          {mobileMainTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => router.push(tab.path)}
              className={`flex flex-col items-center justify-center gap-1 min-w-[64px] min-h-[44px] rounded-xl transition-all ${
                isActive(tab.path) 
                  ? "text-orange-400" 
                  : "text-neutral-500 active:text-neutral-300"
              }`}
            >
              <tab.icon className="w-6 h-6" />
              <span className="text-[11px] font-medium">{tab.label}</span>
            </button>
          ))}
          {/* More Button */}
          <button
            onClick={() => setMoreMenuOpen(!moreMenuOpen)}
            className={`flex flex-col items-center justify-center gap-1 min-w-[64px] min-h-[44px] rounded-xl transition-all ${
              moreMenuOpen || isInMoreSection
                ? "text-orange-400" 
                : "text-neutral-500 active:text-neutral-300"
            }`}
          >
            {moreMenuOpen ? <X className="w-6 h-6" /> : <MoreHorizontal className="w-6 h-6" />}
            <span className="text-[11px] font-medium">Mehr</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
