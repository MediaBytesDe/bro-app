"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import {
  ChevronLeft,
  FileSignature,
  Building2,
  Calendar,
  Euro,
  Send,
  CheckCircle,
  XCircle,
  Pencil,
  Trash2,
  Download,
  ExternalLink,
  Clock,
  FileDown,
} from "lucide-react";
import { downloadQuotePDF } from "@/lib/pdf/quote-pdf";
import { formatDate } from "@/lib/utils";
import type { Quote, QuoteStatus, Customer, QuoteLineItem } from "@/types/database";

const statusLabels: Record<QuoteStatus, string> = {
  draft: "Entwurf",
  sent: "Gesendet",
  viewed: "Angesehen",
  accepted: "Angenommen",
  rejected: "Abgelehnt",
  expired: "Abgelaufen",
  revised: "Überarbeitet",
};

const statusColors: Record<QuoteStatus, string> = {
  draft: "badge-gray",
  sent: "badge-info",
  viewed: "badge-purple",
  accepted: "badge-success",
  rejected: "badge-error",
  expired: "badge-warning",
  revised: "badge-orange",
};

interface Props {
  params: Promise<{ id: string }>;
}

export default function QuoteDetailPage({ params }: Props) {
  const { id } = use(params);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    setLoading(true);

    const { data: quoteData } = await supabase
      .from("quotes")
      .select("*")
      .eq("id", id)
      .single();

    if (quoteData) {
      setQuote(quoteData);

      if (quoteData.customer_id) {
        const { data: customerData } = await supabase
          .from("customers")
          .select("*")
          .eq("id", quoteData.customer_id)
          .single();
        setCustomer(customerData);
      }
    }

    setLoading(false);
  }

  async function updateStatus(newStatus: QuoteStatus) {
    if (!quote) return;

    const updates: Partial<Quote> = { status: newStatus };
    
    if (newStatus === "sent" && !quote.sent_at) {
      updates.sent_at = new Date().toISOString();
    }

    await supabase.from("quotes").update(updates).eq("id", id);
    setQuote({ ...quote, ...updates });
  }

  async function deleteQuote() {
    if (!confirm("Angebot wirklich löschen?")) return;

    await supabase.from("quotes").delete().eq("id", id);
    router.push("/quotes");
  }

  async function syncToLexware() {
    if (!quote) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/lexware/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId: quote.id }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        await loadData(); // Reload to get updated lexware_quote_id
        alert(`✅ Angebot wurde zu Lexware synchronisiert!\nLexware ID: ${data.lexwareQuoteId}`);
      } else {
        alert(`❌ Sync fehlgeschlagen: ${data.error}`);
      }
    } catch (err) {
      alert(`❌ Sync fehlgeschlagen: ${err instanceof Error ? err.message : "Unbekannter Fehler"}`);
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center">
        <Spinner className="mx-auto" />
        <p className="text-neutral-500 mt-4">Lade Angebot...</p>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="p-12 text-center text-neutral-500">
        <span className="text-4xl mb-4 block">❌</span>
        Angebot nicht gefunden
      </div>
    );
  }

  const lineItems = (quote.line_items as QuoteLineItem[]) || [];
  const customerName = customer?.company_name || 
    `${customer?.first_name || ""} ${customer?.last_name || ""}`.trim() || 
    "Unbekannt";

  const isExpired = quote.valid_until && new Date(quote.valid_until) < new Date();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          onClick={() => router.push("/quotes")}
          className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          Zurück zur Liste
        </button>
        <div className="flex items-center gap-3">
          <span className={`badge ${statusColors[quote.status]}`}>
            {statusLabels[quote.status]}
          </span>
          {isExpired && quote.status !== "accepted" && quote.status !== "rejected" && (
            <span className="badge badge-error">Abgelaufen</span>
          )}
        </div>
      </div>

      {/* Main Card */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <FileSignature className="w-7 h-7 text-orange-400" />
              <h2 className="text-2xl font-bold text-white">{quote.title}</h2>
            </div>
            <p className="text-neutral-500">{quote.quote_number}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {quote.status === "draft" && (
              <button onClick={() => updateStatus("sent")} className="btn btn-primary">
                <Send className="w-4 h-4" />
                Als gesendet markieren
              </button>
            )}
            {(quote.status === "sent" || quote.status === "viewed") && (
              <>
                <button onClick={() => updateStatus("accepted")} className="btn btn-success">
                  <CheckCircle className="w-4 h-4" />
                  Angenommen
                </button>
                <button onClick={() => updateStatus("rejected")} className="btn btn-ghost hover:!text-red-400">
                  <XCircle className="w-4 h-4" />
                  Abgelehnt
                </button>
              </>
            )}
            <button 
              onClick={() => downloadQuotePDF({ quote, customer })} 
              className="btn btn-secondary"
            >
              <FileDown className="w-4 h-4" />
              PDF
            </button>
            <button onClick={syncToLexware} disabled={syncing} className="btn btn-secondary">
              {syncing ? <Spinner className="!w-4 !h-4" /> : <ExternalLink className="w-4 h-4" />}
              {syncing ? "Sync..." : "Zu Lexware"}
            </button>
            <button onClick={deleteQuote} className="btn btn-ghost hover:!bg-red-900/30 hover:!text-red-400">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Meta Info */}
        <div className="grid sm:grid-cols-3 gap-4 mb-6 p-4 bg-[#111] rounded-lg">
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5 text-neutral-500" />
            <div>
              <p className="text-xs text-neutral-500">Kunde</p>
              <p className="text-white font-medium">{customerName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-neutral-500" />
            <div>
              <p className="text-xs text-neutral-500">Erstellt</p>
              <p className="text-white font-medium">{formatDate(quote.created_at)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-neutral-500" />
            <div>
              <p className="text-xs text-neutral-500">Gültig bis</p>
              <p className={`font-medium ${isExpired ? "text-red-400" : "text-white"}`}>
                {quote.valid_until ? formatDate(quote.valid_until) : "-"}
              </p>
            </div>
          </div>
        </div>

        {/* Introduction */}
        {quote.introduction && (
          <div className="mb-6">
            <p className="text-neutral-300">{quote.introduction}</p>
          </div>
        )}

        {/* Line Items Table */}
        <div className="border border-[#262626] rounded-lg overflow-hidden mb-6">
          <table className="w-full">
            <thead className="bg-[#111]">
              <tr className="text-left text-sm text-neutral-400">
                <th className="px-4 py-3 w-12">Pos.</th>
                <th className="px-4 py-3">Beschreibung</th>
                <th className="px-4 py-3 text-right w-24">Menge</th>
                <th className="px-4 py-3 text-right w-32">Einzelpreis</th>
                <th className="px-4 py-3 text-right w-32">Gesamt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262626]">
              {lineItems.map((item, idx) => (
                <tr key={item.id || idx} className="text-white">
                  <td className="px-4 py-3 text-neutral-500">{item.position || idx + 1}</td>
                  <td className="px-4 py-3">{item.description}</td>
                  <td className="px-4 py-3 text-right text-neutral-400">
                    {item.quantity} {item.unit}
                  </td>
                  <td className="px-4 py-3 text-right text-neutral-400">
                    {item.unit_price?.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {item.total_price?.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-full sm:w-80 space-y-2">
            <div className="flex justify-between text-neutral-400">
              <span>Netto</span>
              <span className="text-white">
                {quote.total_net?.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
              </span>
            </div>
            <div className="flex justify-between text-neutral-400">
              <span>MwSt. ({quote.tax_rate || 19}%)</span>
              <span className="text-white">
                {quote.total_tax?.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
              </span>
            </div>
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-[#262626]">
              <span className="text-white">Brutto</span>
              <span className="text-green-400">
                {quote.total_gross?.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
              </span>
            </div>
          </div>
        </div>

        {/* Payment Terms */}
        {quote.payment_terms && (
          <div className="mt-6 pt-6 border-t border-[#262626]">
            <h3 className="font-medium text-neutral-400 text-sm uppercase tracking-wide mb-2">
              Zahlungsbedingungen
            </h3>
            <p className="text-neutral-300">{quote.payment_terms}</p>
          </div>
        )}

        {/* Notes */}
        {quote.notes && (
          <div className="mt-6 pt-6 border-t border-[#262626]">
            <h3 className="font-medium text-neutral-400 text-sm uppercase tracking-wide mb-2">
              Interne Notizen
            </h3>
            <p className="text-neutral-300 whitespace-pre-wrap">{quote.notes}</p>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="card p-4 bg-[#111] text-sm text-neutral-500">
        <div className="flex flex-wrap gap-4 sm:gap-6">
          <span>Erstellt: {formatDate(quote.created_at)}</span>
          {quote.sent_at && <span>Gesendet: {formatDate(quote.sent_at)}</span>}
          {quote.lexware_quote_id && (
            <span className="text-blue-400">Lexware: {quote.lexware_quote_id}</span>
          )}
        </div>
      </div>
    </div>
  );
}
