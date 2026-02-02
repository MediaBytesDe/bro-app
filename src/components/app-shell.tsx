"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Bot, Home, Users, Brain, FileText, LogOut, Building2, FileSignature, Calendar, Wrench, FolderOpen, Cpu, ClipboardList, Menu, X } from "lucide-react";
import type { User as AuthUser } from "@supabase/supabase-js";

const tabs = [
  { id: "dashboard", path: "/", label: "Dashboard", icon: Home, mobile: true },
  { id: "customers", path: "/customers", label: "Kunden", icon: Building2, mobile: true },
  { id: "leads", path: "/leads", label: "Leads", icon: Users, mobile: false },
  { id: "quotes", path: "/quotes", label: "Angebote", icon: FileSignature, mobile: true },
  { id: "calendar", path: "/calendar", label: "Kalender", icon: Calendar, mobile: true },
  { id: "forms", path: "/forms", label: "Formulare", icon: ClipboardList, mobile: false },
  { id: "subcontractors", path: "/subcontractors", label: "Subuntern.", icon: Wrench, mobile: false },
  { id: "documents", path: "/documents", label: "Dokumente", icon: FolderOpen, mobile: false },
  { id: "skills", path: "/skills", label: "Skills", icon: Brain, mobile: false },
  { id: "logs", path: "/logs", label: "Logs", icon: FileText, mobile: false },
  { id: "openclaw", path: "/openclaw", label: "OpenClaw", icon: Cpu, mobile: false },
];

const mobileTabs = tabs.filter(t => t.mobile);
const moreTab = { id: "more", path: "", label: "Mehr", icon: Menu, mobile: true };

interface AppShellProps {
  user: AuthUser;
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };

  const isMoreActive = tabs.filter(t => !t.mobile).some(t => isActive(t.path));

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
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
            {tabs.map((tab) => (
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

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0d0d0d] border-t border-[#1a1a1a] md:hidden safe-area-bottom z-40">
        <div className="flex items-center justify-around py-2">
          {mobileTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => router.push(tab.path)}
              className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg transition-all ${
                isActive(tab.path) ? "text-orange-400" : "text-neutral-500 active:text-neutral-300"
              }`}
            >
              <tab.icon className="w-6 h-6" />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          ))}
          {/* More Button */}
          <button
            onClick={() => setShowMoreMenu(true)}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg transition-all ${
              isMoreActive ? "text-orange-400" : "text-neutral-500 active:text-neutral-300"
            }`}
          >
            <Menu className="w-6 h-6" />
            <span className="text-[10px] font-medium">Mehr</span>
          </button>
        </div>
      </nav>

      {/* More Menu Overlay */}
      {showMoreMenu && (
        <div 
          className="fixed inset-0 bg-black/80 z-50 md:hidden"
          onClick={() => setShowMoreMenu(false)}
        >
          <div 
            className="absolute bottom-0 left-0 right-0 bg-[#111] rounded-t-2xl p-4 safe-area-bottom"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Mehr</h3>
              <button 
                onClick={() => setShowMoreMenu(false)}
                className="p-2 text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {tabs.filter(t => !t.mobile).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    router.push(tab.path);
                    setShowMoreMenu(false);
                  }}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${
                    isActive(tab.path) 
                      ? "bg-orange-500/20 text-orange-400" 
                      : "bg-[#1a1a1a] text-neutral-400 active:bg-[#222]"
                  }`}
                >
                  <tab.icon className="w-6 h-6" />
                  <span className="text-xs font-medium">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
