"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Home, Users, Brain, FileText, LogOut, Building2,
  FileSignature, Calendar, Wrench, FolderOpen, Cpu, Bot,
  ClipboardList, MoreHorizontal, X, Package, ChevronDown,
  UserCircle, ShoppingCart, Briefcase, Settings, MessageSquare, MessageSquareMore, Download, Database, Sparkles, Receipt, BarChart3
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Einzelne Tabs (für Mobile)
const allTabs = [
  { id: "dashboard", path: "/", label: "Home", icon: Home },
  { id: "customers", path: "/customers", label: "Kunden", icon: Building2 },
  { id: "leads", path: "/leads", label: "Leads", icon: Users },
  { id: "quotes", path: "/quotes", label: "Angebote", icon: FileSignature },
  { id: "anfragen", path: "/anfragen", label: "Anfragen", icon: MessageSquareMore },
  { id: "articles", path: "/articles", label: "Artikel", icon: Package },
  { id: "shopify-import", path: "/shopify-import", label: "Shopify Import", icon: Download },
  { id: "wawi-import", path: "/wawi-import", label: "WAWI Import", icon: Database },
  { id: "calendar", path: "/calendar", label: "Kalender", icon: Calendar },
  { id: "nachrichten", path: "/nachrichten", label: "Nachrichten", icon: MessageSquare },
  { id: "forms", path: "/forms", label: "Formulare", icon: ClipboardList },
  { id: "subcontractors", path: "/subcontractors", label: "Subuntern.", icon: Wrench },
  { id: "trades", path: "/trades", label: "Gewerke", icon: Briefcase },
  { id: "rechnungen", path: "/rechnungen", label: "Rechnungen", icon: Receipt },
  { id: "statistiken", path: "/statistiken", label: "Statistiken", icon: BarChart3 },
  { id: "documents", path: "/documents", label: "Dokumente", icon: FolderOpen },
  { id: "skills", path: "/skills", label: "Skills", icon: Brain },
  { id: "logs", path: "/logs", label: "Logs", icon: FileText },
  { id: "openclaw", path: "/openclaw", label: "OpenClaw", icon: Bot },
  { id: "ai-prompts", path: "/ai-prompts", label: "KI-Prompts", icon: Sparkles },
];

// Desktop Navigation mit Dropdown-Gruppen
interface NavItem {
  id: string;
  path?: string;
  label: string;
  icon: LucideIcon;
  children?: { id: string; path: string; label: string; icon: LucideIcon; description?: string }[];
}

const desktopNav: NavItem[] = [
  { id: "dashboard", path: "/", label: "Home", icon: Home },
  { 
    id: "crm", 
    label: "CRM", 
    icon: UserCircle,
    children: [
      { id: "customers", path: "/customers", label: "Kunden", icon: Building2, description: "Kundenverwaltung & Kontakte" },
      { id: "leads", path: "/leads", label: "Leads", icon: Users, description: "Interessenten & Akquise" },
    ]
  },
  {
    id: "sales",
    label: "Vertrieb",
    icon: ShoppingCart,
    children: [
      { id: "quotes", path: "/quotes", label: "Angebote", icon: FileSignature, description: "Angebote erstellen & verwalten" },
      { id: "anfragen", path: "/anfragen", label: "Anfragen", icon: MessageSquareMore, description: "Kundenanfragen verwalten" },
      { id: "articles", path: "/articles", label: "Artikel", icon: Package, description: "Produkte & Dienstleistungen" },
      { id: "stock", path: "/articles/stock", label: "Lagerbestand", icon: Package, description: "Bestände & Warenbewegungen" },
      { id: "shopify-import", path: "/shopify-import", label: "Shopify Import", icon: Download, description: "Solarhandel24 Import" },
      { id: "wawi-import", path: "/wawi-import", label: "WAWI Import", icon: Database, description: "Altes WAWI System Import" },
    ]
  },
  {
    id: "projects",
    label: "Projekte",
    icon: Briefcase,
    children: [
      { id: "calendar", path: "/calendar", label: "Kalender", icon: Calendar, description: "Termine & Planung" },
      { id: "nachrichten", path: "/nachrichten", label: "Nachrichten", icon: MessageSquare, description: "Projekt-Kommunikation" },
      { id: "documents", path: "/documents", label: "Dokumente", icon: FolderOpen, description: "Dateien & Uploads" },
      { id: "forms", path: "/forms", label: "Formulare", icon: ClipboardList, description: "Abnahmen & Protokolle" },
      { id: "subcontractors", path: "/subcontractors", label: "Subunternehmer", icon: Wrench, description: "Partner & Monteure" },
      { id: "trades", path: "/trades", label: "Gewerke", icon: Wrench, description: "DC/AC-Montage, Elektro, etc." },
      { id: "rechnungen", path: "/rechnungen", label: "Rechnungen", icon: Receipt, description: "Partner-Rechnungen zuordnen" },
      { id: "statistiken", path: "/statistiken", label: "Statistiken", icon: BarChart3, description: "Gewinn, Margen & Kosten" },
    ]
  },
  {
    id: "system",
    label: "System",
    icon: Settings,
    children: [
      { id: "skills", path: "/skills", label: "Skills", icon: Brain, description: "Bro Fähigkeiten" },
      { id: "logs", path: "/logs", label: "Logs", icon: FileText, description: "Aktivitätsprotokoll" },
      { id: "openclaw", path: "/openclaw", label: "OpenClaw", icon: Bot, description: "KI-Assistenten" },
      { id: "ai-prompts", path: "/ai-prompts", label: "KI-Prompts", icon: Sparkles, description: "Content-Vorlagen verwalten" },
    ]
  },
];

// Mobile: 4 main + Mehr
const mobileMainTabs = allTabs.slice(0, 4);
const mobileMoreTabs = allTabs.slice(4);

interface AppShellProps {
  children: React.ReactNode;
}

// Dropdown Komponente für Desktop
function NavDropdown({ 
  item, 
  isOpen, 
  onToggle, 
  onClose, 
  isActive, 
  router 
}: { 
  item: NavItem; 
  isOpen: boolean; 
  onToggle: () => void; 
  onClose: () => void;
  isActive: (path: string) => boolean; 
  router: ReturnType<typeof useRouter>;
}) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const hasActiveChild = item.children?.some(child => isActive(child.path)) ?? false;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  if (!item.children) {
    return (
      <button
        onClick={() => item.path && router.push(item.path)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
          item.path && isActive(item.path)
            ? "bg-gradient-to-r from-[#fa432a]/20 to-[#ff6b4a]/20 text-[#fa432a]"
            : "text-neutral-400 hover:text-white hover:bg-white/5"
        }`}
      >
        <item.icon className="w-4 h-4" />
        {item.label}
      </button>
    );
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={onToggle}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
          isOpen || hasActiveChild
            ? "bg-gradient-to-r from-[#fa432a]/20 to-[#ff6b4a]/20 text-[#fa432a]"
            : "text-neutral-400 hover:text-white hover:bg-white/5"
        }`}
      >
        <item.icon className="w-4 h-4" />
        {item.label}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div 
          className="absolute top-full left-0 mt-2 w-64 bg-[#111] border border-[#262626] rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-50"
          style={{ animation: "fadeSlideDown 0.15s ease" }}
        >
          <div className="p-2">
            {item.children.map((child) => (
              <button
                key={child.id}
                onClick={() => {
                  router.push(child.path);
                  onClose();
                }}
                className={`w-full flex items-start gap-3 p-3 rounded-lg transition-all ${
                  isActive(child.path)
                    ? "bg-[#fa432a]/10 text-[#fa432a]"
                    : "text-neutral-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <div className={`p-2 rounded-lg ${isActive(child.path) ? "bg-[#fa432a]/20" : "bg-white/5"}`}>
                  <child.icon className="w-4 h-4" />
                </div>
                <div className="text-left">
                  <div className="font-medium text-sm">{child.label}</div>
                  {child.description && (
                    <div className="text-xs text-neutral-500 mt-0.5">{child.description}</div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };

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
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      {/* Header - Minimal auf Mobile */}
      <header className="sticky top-0 z-30 glass border-b border-[#1a1a1a]">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center">
            <img 
              src="/logo.png" 
              alt="BROjekt GmbH" 
              className="h-8 w-auto"
            />
          </div>

          {/* Desktop Nav - Mit Dropdowns */}
          <nav className="hidden md:flex items-center gap-1">
            {desktopNav.map((item) => (
              <NavDropdown
                key={item.id}
                item={item}
                isOpen={openDropdown === item.id}
                onToggle={() => setOpenDropdown(openDropdown === item.id ? null : item.id)}
                onClose={() => setOpenDropdown(null)}
                isActive={isActive}
                router={router}
              />
            ))}
          </nav>

          <button
            onClick={handleLogout}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-neutral-500 hover:text-white hover:bg-white/5 transition-colors"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-5 pb-28 md:pb-6 overflow-visible">{children}</main>

      {/* Mobile "Mehr" Menu - Bottom Sheet Style */}
      {moreMenuOpen && (
        <div 
          className="fixed inset-0 z-40 md:hidden"
          onClick={() => setMoreMenuOpen(false)}
        >
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            style={{ animation: "fadeIn 0.2s ease" }}
          />
          
          {/* Bottom Sheet */}
          <div 
            className="absolute bottom-20 left-3 right-3 bg-[#111] border border-[#262626] rounded-3xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: "fadeSlideUp 0.25s ease" }}
          >
            {/* Swipe Indicator */}
            <div className="swipe-indicator" />
            
            <div className="grid grid-cols-4 gap-1 p-2 pb-4">
              {mobileMoreTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleMoreTabClick(tab.path)}
                  className={`flex flex-col items-center gap-2 py-4 px-2 rounded-2xl transition-all active:scale-95 ${
                    isActive(tab.path) 
                      ? "bg-gradient-to-br from-[#fa432a]/20 to-[#ff6b4a]/20 text-[#fa432a]" 
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

      {/* Mobile Bottom Nav - Modern iOS Style */}
      <nav className="fixed bottom-0 left-0 right-0 glass border-t border-[#1a1a1a] md:hidden safe-area-bottom z-50">
        <div className="flex items-stretch justify-around py-2 px-2">
          {mobileMainTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => router.push(tab.path)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-2xl transition-all active:scale-90 ${
                isActive(tab.path) 
                  ? "text-[#fa432a]" 
                  : "text-neutral-500"
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-all ${isActive(tab.path) ? "bg-[#fa432a]/10" : ""}`}>
                <tab.icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          ))}
          
          {/* More Button */}
          <button
            onClick={() => setMoreMenuOpen(!moreMenuOpen)}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-2xl transition-all active:scale-90 ${
              moreMenuOpen || isInMoreSection
                ? "text-[#fa432a]" 
                : "text-neutral-500"
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${moreMenuOpen || isInMoreSection ? "bg-[#fa432a]/10" : ""}`}>
              {moreMenuOpen ? <X className="w-5 h-5" /> : <MoreHorizontal className="w-5 h-5" />}
            </div>
            <span className="text-[10px] font-medium">Mehr</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
