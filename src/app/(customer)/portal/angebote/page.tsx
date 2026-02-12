"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import { FileText, Download, ChevronDown, ChevronRight } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

export default function CustomerQuotesPage() {
  const { profile } = useAuth();
  const searchParams = useSearchParams();
  const impersonateId = searchParams.get("impersonate");
  const isAdmin = profile?.role === "admin" || profile?.role === "superadmin";
  const isImpersonating = isAdmin && !!impersonateId;
  
  const [loading, setLoading] = useState(true);
  const [quotes, setQuotes] = useState<any[]>([]);

  const supabase = createClient();

  useEffect(() => {
    loadQuotes();
  }, [profile, impersonateId]);

  async function loadQuotes() {
    if (!profile?.auth_id) { setLoading(false); return; }

    try {
      let customerId: string | null = null;
      
      if (isImpersonating && impersonateId) {
        customerId = impersonateId;
      } else {
        const { data: customer } = await supabase
          .from("customers")
          .select("id")
          .eq("auth_user_id", profile.auth_id)
          .single();

        if (!customer) {
          setLoading(false);
          return;
        }
        customerId = customer.id;
      }

      const { data: quotesData } = await supabase
        .from("wawi_quotes")
        .select(`
          id, title, package_title, lexware_quote_number, status, 
          total_amount, quote_date, valid_until, lexware_quotation_id,
          project:projects(name, slug)
        `)
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      setQuotes(quotesData || []);
      
      // Track viewed event for open quotes (non-impersonating only)
      if (!isImpersonating && quotesData) {
        for (const q of quotesData.filter(q => q.status === "sent")) {
          fetch("/api/quotes/track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ quoteId: q.id, event: "viewed" }),
          }).catch(() => {}); // fire and forget
        }
      }
    } catch (err) {
      console.error("Error loading quotes:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  const openQuotes = quotes.filter(q => q.status === "sent");
  const acceptedQuotes = quotes.filter(q => q.status === "accepted");
  const rejectedQuotes = quotes.filter(q => q.status === "rejected");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Meine Angebote</h1>
        <p className="text-neutral-400 mt-1">
          Übersicht aller Angebote von BROjekt
        </p>
      </div>

      {quotes.length === 0 ? (
        <div className="card p-12 text-center">
          <FileText className="w-16 h-16 mx-auto text-neutral-600 mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Noch keine Angebote</h3>
          <p className="text-neutral-400">
            Sobald wir ein Angebot für Sie erstellen, erscheint es hier.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {openQuotes.length > 0 && (
            <QuoteTable title="Offene Angebote" quotes={openQuotes} color="yellow" />
          )}
          {acceptedQuotes.length > 0 && (
            <QuoteTable title="Angenommene Angebote" quotes={acceptedQuotes} color="green" />
          )}
          {rejectedQuotes.length > 0 && (
            <QuoteTable title="Abgelehnte Angebote" quotes={rejectedQuotes} color="red" collapsed />
          )}
        </div>
      )}
    </div>
  );
}

function QuoteTable({ title, quotes, color, collapsed = false }: { 
  title: string; 
  quotes: any[]; 
  color: string;
  collapsed?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(!collapsed);

  const dotColors: Record<string, string> = {
    yellow: "bg-yellow-400",
    green: "bg-green-400",
    red: "bg-red-400",
  };

  const statusColors: Record<string, string> = {
    draft: "bg-neutral-500/20 text-neutral-400",
    sent: "bg-yellow-500/20 text-yellow-400",
    accepted: "bg-green-500/20 text-green-400",
    rejected: "bg-red-500/20 text-red-400",
  };

  const statusLabels: Record<string, string> = {
    draft: "Entwurf",
    sent: "Offen",
    accepted: "Angenommen",
    rejected: "Abgelehnt",
  };

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 p-4 border-b border-neutral-800 hover:bg-[#111] transition-colors"
      >
        <span className={cn("w-2 h-2 rounded-full", dotColors[color])} />
        <span className="font-semibold text-white">{title}</span>
        <span className="text-sm text-neutral-500">({quotes.length})</span>
        <span className="ml-auto">
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-neutral-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-neutral-500" />
          )}
        </span>
      </button>

      {isOpen && (
        <table className="w-full">
          <thead>
            <tr className="text-xs text-neutral-500 uppercase tracking-wide border-b border-neutral-800 bg-[#0a0a0a]">
              <th className="text-left py-3 px-4">Angebot</th>
              <th className="text-left py-3 px-4 w-28">Datum</th>
              <th className="text-right py-3 px-4 w-32">Betrag</th>
              <th className="text-left py-3 px-4 w-28">Status</th>
              <th className="w-20"></th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((quote) => (
              <tr
                key={quote.id}
                className="border-b border-neutral-800/50 last:border-0 hover:bg-[#111] transition-colors"
              >
                <td className="py-3 px-4">
                  <div>
                    <span className="text-xs font-mono text-neutral-500 mr-2">
                      {quote.lexware_quote_number || `#${quote.id.slice(0, 6)}`}
                    </span>
                    <span className="text-white font-medium">
                      {quote.package_title || quote.title}
                    </span>
                  </div>
                  {quote.project && (
                    <p className="text-xs text-neutral-500 mt-0.5">{quote.project.name}</p>
                  )}
                </td>
                <td className="py-3 px-4 text-sm text-neutral-400">
                  {formatDate(quote.quote_date)}
                </td>
                <td className="py-3 px-4 text-right">
                  <span className="text-white font-bold">
                    {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(quote.total_amount)}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className={cn("text-xs px-2 py-1 rounded whitespace-nowrap", statusColors[quote.status])}>
                    {statusLabels[quote.status]}
                  </span>
                </td>
                <td className="py-3 px-4">
                  {quote.lexware_quotation_id && (
                    <button
                      onClick={() => window.open(`/api/lexware/quote-pdf?lexwareId=${quote.lexware_quotation_id}`, "_blank")}
                      className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                    >
                      <Download className="w-3 h-3" />
                      PDF
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
