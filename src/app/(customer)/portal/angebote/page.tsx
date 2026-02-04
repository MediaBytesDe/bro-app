"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import { FileText, Download } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function CustomerQuotesPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [quotes, setQuotes] = useState<any[]>([]);

  const supabase = createClient();

  useEffect(() => {
    loadQuotes();
  }, [profile]);

  async function loadQuotes() {
    if (!profile?.auth_id) return;

    // Find customer by auth_user_id
    const { data: customer } = await supabase
      .from("customers")
      .select("id")
      .eq("auth_user_id", profile.auth_id)
      .single();

    if (!customer) {
      setLoading(false);
      return;
    }

    // Load all quotes for this customer
    const { data: quotesData } = await supabase
      .from("wawi_quotes")
      .select(`
        id, title, package_title, lexware_quote_number, status, 
        total_amount, quote_date, valid_until, lexware_quotation_id,
        project:projects(name, slug)
      `)
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false });

    setQuotes(quotesData || []);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  // Group quotes by status
  const openQuotes = quotes.filter(q => q.status === "sent");
  const acceptedQuotes = quotes.filter(q => q.status === "accepted");
  const rejectedQuotes = quotes.filter(q => q.status === "rejected");
  const draftQuotes = quotes.filter(q => q.status === "draft");

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
        <div className="space-y-8">
          {/* Open Quotes */}
          {openQuotes.length > 0 && (
            <QuoteSection title="Offene Angebote" quotes={openQuotes} color="yellow" />
          )}

          {/* Accepted Quotes */}
          {acceptedQuotes.length > 0 && (
            <QuoteSection title="Angenommene Angebote" quotes={acceptedQuotes} color="green" />
          )}

          {/* Rejected Quotes */}
          {rejectedQuotes.length > 0 && (
            <QuoteSection title="Abgelehnte Angebote" quotes={rejectedQuotes} color="red" collapsed />
          )}
        </div>
      )}
    </div>
  );
}

function QuoteSection({ title, quotes, color, collapsed = false }: { 
  title: string; 
  quotes: any[]; 
  color: string;
  collapsed?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(!collapsed);

  const colors: Record<string, string> = {
    yellow: "text-yellow-400",
    green: "text-green-400",
    red: "text-red-400",
  };

  return (
    <section>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500 hover:text-white transition-colors"
      >
        <span className={`w-2 h-2 rounded-full bg-current ${colors[color]}`} />
        {title} ({quotes.length})
        <span className="text-xs">{isOpen ? "▼" : "▶"}</span>
      </button>

      {isOpen && (
        <div className="grid gap-4">
          {quotes.map((quote) => (
            <QuoteCard key={quote.id} quote={quote} />
          ))}
        </div>
      )}
    </section>
  );
}

function QuoteCard({ quote }: { quote: any }) {
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
    <div className="card p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-mono text-neutral-500">
              {quote.lexware_quote_number || `#${quote.id.slice(0, 6)}`}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded ${statusColors[quote.status]}`}>
              {statusLabels[quote.status]}
            </span>
          </div>
          <h3 className="text-lg font-semibold text-white">
            {quote.package_title || quote.title}
          </h3>
          {quote.project && (
            <p className="text-sm text-neutral-500 mt-1">
              Projekt: {quote.project.name}
            </p>
          )}
          <div className="flex gap-4 mt-2 text-xs text-neutral-500">
            <span>Datum: {formatDate(quote.quote_date)}</span>
            {quote.valid_until && (
              <span>Gültig bis: {formatDate(quote.valid_until)}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-2xl font-bold text-white">
              {new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(quote.total_amount)}
            </p>
            <p className="text-xs text-neutral-500">inkl. MwSt.</p>
          </div>
          
          {quote.lexware_quotation_id && (
            <button
              onClick={() => window.open(`/api/lexware/quote-pdf?lexwareId=${quote.lexware_quotation_id}`, "_blank")}
              className="btn btn-primary btn-sm"
            >
              <Download className="w-4 h-4" />
              PDF
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
