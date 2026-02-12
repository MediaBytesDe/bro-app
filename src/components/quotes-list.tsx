"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import { Modal } from "@/components/ui/modal";
import { PDFViewer } from "@/components/pdf-viewer";
import {
  FileSignature,
  Plus,
  Search,
  ChevronRight,
  ChevronDown,
  Calendar,
  Building2,
  Euro,
  Filter,
  X,
  FileStack,
  Trash2,
  FileText,
  Eye,
  RefreshCw,
} from "lucide-react";
import {
  WawiQuote,
  QUOTE_STATUSES,
  formatCurrency
} from "@/types/wawi";

const statusColors: Record<string, { bg: string; text: string }> = {
  draft: { bg: "bg-neutral-500/20", text: "text-neutral-400" },
  sent_to_lexware: { bg: "bg-blue-500/20", text: "text-blue-400" },
  sent: { bg: "bg-cyan-500/20", text: "text-cyan-400" },
  open: { bg: "bg-yellow-500/20", text: "text-yellow-400" },
  accepted: { bg: "bg-green-500/20", text: "text-green-400" },
  rejected: { bg: "bg-red-500/20", text: "text-red-400" },
  expired: { bg: "bg-neutral-500/20", text: "text-neutral-400" },
};

export function QuotesList() {
  const [quotes, setQuotes] = useState<WawiQuote[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WawiQuote | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [rejectedCollapsed, setRejectedCollapsed] = useState(true);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadQuotes();
    
    // Reload when page becomes visible again (browser back button)
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        loadQuotes();
      }
    };
    
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", loadQuotes);
    
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", loadQuotes);
    };
  }, []);

  async function loadQuotes() {
    const { data, error } = await supabase
      .from("wawi_quotes")
      .select(`
        *,
        customer:customers(id, company_name, first_name, last_name)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading quotes:", error);
    }
    
    if (data) {
      setQuotes(data);
    }
    setInitialLoading(false);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    
    const { error } = await supabase
      .from("wawi_quotes")
      .delete()
      .eq("id", deleteTarget.id);
    
    setDeleting(false);
    setDeleteTarget(null);
    
    if (!error) {
      loadQuotes();
    }
  }

  async function updateStatus(id: string, status: string) {
    const now = new Date().toISOString();
    const updates: Record<string, any> = { 
      status, 
      updated_at: now,
    };
    
    // Auto-track status timestamps
    switch (status) {
      case "sent":
      case "sent_to_lexware":
        updates.sent_at = now;
        break;
      case "accepted":
        updates.accepted_at = now;
        break;
      case "rejected":
        updates.rejected_at = now;
        break;
    }
    
    await supabase
      .from("wawi_quotes")
      .update(updates)
      .eq("id", id);
    loadQuotes();
  }

  async function syncLexwareStatus() {
    setSyncing(true);
    try {
      const res = await fetch("/api/lexware/sync-quote-status", { method: "POST" });
      const data = await res.json();
      if (data.synced > 0) {
        loadQuotes();
      }
    } catch (err) {
      console.error("Sync error:", err);
    } finally {
      setSyncing(false);
    }
  }

  function openPdfModal(lexwareId: string) {
    setPdfUrl(`/api/lexware/quote-pdf?lexwareId=${lexwareId}`);
    setPdfModalOpen(true);
  }

  function closePdfModal() {
    setPdfModalOpen(false);
    setPdfUrl(null);
  }

  function getCustomerName(quote: WawiQuote): string {
    if (!quote.customer) return "Kein Kunde";
    if (quote.customer.company_name) return quote.customer.company_name;
    return `${quote.customer.first_name || ""} ${quote.customer.last_name || ""}`.trim() || "Unbenannt";
  }

  const filtered = quotes.filter((q) => {
    const matchesSearch = !search || 
      getCustomerName(q).toLowerCase().includes(search.toLowerCase()) ||
      (q.quote_number || "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Stats
  const stats = {
    total: quotes.length,
    draft: quotes.filter(q => q.status === "draft").length,
    open: quotes.filter(q => ["sent", "open"].includes(q.status)).length,
    accepted: quotes.filter(q => q.status === "accepted").length,
  };

  if (initialLoading && quotes.length === 0) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Angebote</h1>
          <p className="text-sm text-neutral-500">{quotes.length} Angebote</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={syncLexwareStatus}
            disabled={syncing}
            className="flex items-center gap-2 px-3 py-2 bg-[#111] border border-[#1a1a1a] rounded-xl text-neutral-400 hover:text-white hover:border-[#333] transition-colors disabled:opacity-50"
            title="Lexware-Status synchronisieren"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            <span className="text-sm hidden md:inline">Sync</span>
          </button>
          <button
            onClick={() => router.push("/quotes/templates")}
            className="flex items-center gap-2 px-3 py-2 bg-[#111] border border-[#1a1a1a] rounded-xl text-neutral-400 hover:text-white hover:border-[#333] transition-colors"
          >
            <FileStack className="w-4 h-4" />
            <span className="text-sm hidden md:inline">Vorlagen</span>
          </button>
          <button
            onClick={() => router.push("/quotes/new")}
            className="w-10 h-10 rounded-full bg-gradient-to-br from-[#fa432a] to-[#ff6b4a] flex items-center justify-center text-white shadow-lg shadow-[#fa432a]/20 active:scale-95 transition-transform"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
        <QuickStat value={stats.draft} label="Entwürfe" color="gray" />
        <QuickStat value={stats.open} label="Offen" color="yellow" />
        <QuickStat value={stats.accepted} label="Angenommen" color="green" />
      </div>

      {/* Filter Chips */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
        <button
          onClick={() => setStatusFilter(null)}
          className={`chip whitespace-nowrap ${!statusFilter ? "active" : ""}`}
        >
          Alle
        </button>
        {Object.entries(QUOTE_STATUSES).map(([key, { label }]) => {
          const count = quotes.filter(q => q.status === key).length;
          if (count === 0) return null;
          const colors = statusColors[key];
          return (
            <button
              key={key}
              onClick={() => setStatusFilter(statusFilter === key ? null : key)}
              className={`chip whitespace-nowrap ${statusFilter === key ? colors.bg + " " + colors.text : ""}`}
            >
              {label} ({count})
            </button>
          );
        })}
      </div>

      {/* Search */}
      {quotes.length > 5 && (
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
          <input
            type="text"
            placeholder="Suchen..."
            className="search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button 
              onClick={() => setSearch("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-neutral-800 flex items-center justify-center"
            >
              <X className="w-3 h-3 text-neutral-400" />
            </button>
          )}
        </div>
      )}

      {/* Quotes List - Grouped by Status */}
      {filtered.length === 0 ? (
        <EmptyState onCreate={() => router.push("/quotes/new")} />
      ) : (
        <div className="space-y-4">
          {/* Group order: draft, open/sent, accepted, rejected/expired */}
          {[
            { key: "draft", label: "Entwürfe", statuses: ["draft"] },
            { key: "open", label: "Offen", statuses: ["sent", "open", "sent_to_lexware"] },
            { key: "accepted", label: "Angenommen", statuses: ["accepted"] },
            { key: "closed", label: "Abgelehnt", statuses: ["rejected", "expired"], collapsible: true },
          ].map((group) => {
            const groupQuotes = filtered.filter(q => group.statuses.includes(q.status));
            if (groupQuotes.length === 0) return null;
            
            const isCollapsed = group.collapsible && rejectedCollapsed;
            
            return (
              <div key={group.key}>
                <button 
                  onClick={() => group.collapsible && setRejectedCollapsed(!rejectedCollapsed)}
                  className={`flex items-center gap-2 mb-1.5 px-1 w-full text-left ${group.collapsible ? "cursor-pointer hover:opacity-80" : ""}`}
                >
                  {group.collapsible && (
                    <ChevronDown className={`w-3 h-3 text-neutral-500 transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
                  )}
                  <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">{group.label}</span>
                  <span className="text-xs text-neutral-600">({groupQuotes.length})</span>
                </button>
                {!isCollapsed && (
                  <div className="space-y-1">
                    {groupQuotes.map((quote, i) => (
                      <QuoteCard
                        key={quote.id}
                        quote={quote}
                        index={i}
                        onClick={() => router.push(`/quotes/${quote.id}`)}
                        onDelete={quote.status === "draft" ? () => setDeleteTarget(quote) : undefined}
                        onStatusChange={(status) => updateStatus(quote.id, status)}
                        onOpenPdf={openPdfModal}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Angebot löschen">
        <div className="space-y-4">
          <p className="text-neutral-300">
            Möchtest du das Angebot <span className="font-semibold text-white">{deleteTarget?.quote_number || `#${deleteTarget?.id.slice(0, 8)}`}</span> wirklich löschen?
          </p>
          <p className="text-sm text-neutral-500">
            Diese Aktion kann nicht rückgängig gemacht werden.
          </p>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setDeleteTarget(null)}
              className="flex-1 btn btn-secondary"
            >
              Abbrechen
            </button>
            <button
              onClick={confirmDelete}
              disabled={deleting}
              className="flex-1 btn bg-red-500 hover:bg-red-600 text-white"
            >
              {deleting ? "Löschen..." : "Löschen"}
            </button>
          </div>
        </div>
      </Modal>

      {/* PDF Viewer */}
      <PDFViewer
        isOpen={pdfModalOpen}
        pdfUrl={pdfUrl}
        title="Angebot (Lexware)"
        onClose={closePdfModal}
      />
    </div>
  );
}

// Quick Stat
function QuickStat({ value, label, color }: { 
  value: number; 
  label: string; 
  color: "gray" | "yellow" | "green";
}) {
  const colors = {
    gray: "from-neutral-500/20 to-neutral-600/20 text-neutral-400",
    yellow: "from-yellow-500/20 to-orange-500/20 text-yellow-400",
    green: "from-green-500/20 to-emerald-500/20 text-green-400",
  };

  return (
    <div className={`flex-shrink-0 flex flex-col items-center px-5 py-3 rounded-2xl bg-gradient-to-br ${colors[color]} min-w-[100px]`}>
      <span className="text-2xl font-bold text-white">{value}</span>
      <span className="text-xs opacity-70">{label}</span>
    </div>
  );
}

// Quote Card
function QuoteCard({ quote, index, onClick, onDelete, onStatusChange, onOpenPdf }: {
  quote: WawiQuote;
  index: number;
  onClick: () => void;
  onDelete?: () => void;
  onStatusChange: (status: string) => void;
  onOpenPdf: (lexwareId: string) => void;
}) {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!showStatusMenu) return;
    
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowStatusMenu(false);
      }
    }
    
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [showStatusMenu]);
  
  const statusInfo = QUOTE_STATUSES[quote.status] || QUOTE_STATUSES.draft;
  const colors = statusColors[quote.status] || statusColors.draft;
  const isExported = !!(quote as any).lexware_quotation_id;
  const lexwareNumber = (quote as any).lexware_quote_number;
  const isViewed = !!(quote as any).viewed_at;
  const sentAt = (quote as any).sent_at;
  const acceptedAt = (quote as any).accepted_at;

  const customerName = quote.customer 
    ? (quote.customer.company_name || `${quote.customer.first_name || ""} ${quote.customer.last_name || ""}`.trim() || "Unbenannt")
    : "Kein Kunde";

  const handleClick = () => {
    if (isExported) {
      onOpenPdf((quote as any).lexware_quotation_id);
    } else {
      onClick();
    }
  };

  return (
    <div
      className={`group px-3 py-2 bg-[#111] border border-[#1a1a1a] rounded-xl transition-all hover:border-[#262626] relative ${showStatusMenu ? "z-50" : ""}`}
      style={{ 
        animationDelay: `${index * 30}ms`,
        animation: "fadeSlideUp 0.2s ease forwards",
        opacity: 0,
      }}
    >
      <div className="flex items-center gap-3">
        {/* Main Content - Clickable */}
        <div onClick={handleClick} className="flex-1 min-w-0 flex items-center gap-3 cursor-pointer">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {isExported && (
                <FileText className="w-3 h-3 text-blue-400 shrink-0" />
              )}
              <span className={`text-xs font-mono ${isExported ? "text-blue-400" : "text-neutral-600"}`}>
                {lexwareNumber || quote.quote_number || `#${quote.id.slice(0, 6)}`}
              </span>
              {/* Status Badge - Clickable for menu */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowStatusMenu(!showStatusMenu);
                }}
                className={`text-[10px] px-1.5 py-0.5 rounded ${colors.bg} ${colors.text} hover:opacity-80`}
              >
                {statusInfo.label}
              </button>
              {isViewed && (
                <span className="text-[10px] text-purple-400 flex items-center gap-0.5" title={`Angesehen: ${new Date((quote as any).viewed_at).toLocaleString("de-DE")}`}>
                  <Eye className="w-3 h-3" />
                </span>
              )}
              <span className="text-xs text-neutral-600">
                {new Date(quote.quote_date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
              </span>
            </div>
            <h3 className="text-sm font-medium text-white group-hover:text-[#fa432a] transition-colors truncate">
              {customerName}
            </h3>
          </div>
          <span className="text-sm font-bold text-white shrink-0">
            {formatCurrency(quote.rounded_total || quote.total_amount)}
          </span>
        </div>
        
        {/* Actions */}
        {onDelete && (
          <button
            onClick={onDelete}
            className="w-6 h-6 flex items-center justify-center text-neutral-600 hover:text-red-400 rounded transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
        {/* Arrow always goes to detail/edit view */}
        <span onClick={onClick} className="cursor-pointer" title="Details anzeigen">
          <ChevronRight className="w-4 h-4 text-neutral-600 hover:text-[#fa432a]" />
        </span>
      </div>
      
      {/* Status Menu */}
      {showStatusMenu && (
        <div 
          ref={menuRef}
          className="absolute left-16 top-1 z-[100] bg-[#1a1a1a] border border-[#333] rounded-lg shadow-xl py-1 min-w-[140px]"
        >
          {Object.entries(QUOTE_STATUSES).map(([key, value]) => (
            <button
              key={key}
              onClick={(e) => {
                e.stopPropagation();
                onStatusChange(key);
                setShowStatusMenu(false);
              }}
              className={`w-full px-3 py-1.5 text-left text-xs hover:bg-[#262626] flex items-center gap-2 ${
                quote.status === key ? "text-[#fa432a]" : "text-neutral-300"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${statusColors[key]?.bg || "bg-neutral-500"}`} />
              {value.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Empty State
function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="text-center py-16 px-4">
      <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-orange-500/10 to-red-500/10 flex items-center justify-center">
        <FileSignature className="w-10 h-10 text-[#fa432a]/50" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">Keine Angebote</h3>
      <p className="text-neutral-500 mb-6 max-w-xs mx-auto">
        Erstelle dein erstes Angebot
      </p>
      <button onClick={onCreate} className="btn btn-primary">
        <Plus className="w-4 h-4" />
        Angebot erstellen
      </button>
    </div>
  );
}
