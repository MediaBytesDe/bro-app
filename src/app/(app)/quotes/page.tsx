"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import {
  FileSignature,
  Plus,
  Search,
  Euro,
  Clock,
  ChevronRight,
  Building2,
  Send,
  CheckCircle,
  XCircle,
  Eye,
  Trash2,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { Quote, QuoteStatus, Customer } from "@/types/database";

// Partial customer type for dropdown selections
type CustomerOption = Pick<Customer, "id" | "company_name" | "first_name" | "last_name">;

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

const statusIcons: Record<QuoteStatus, React.ReactNode> = {
  draft: <FileSignature className="w-4 h-4" />,
  sent: <Send className="w-4 h-4" />,
  viewed: <Eye className="w-4 h-4" />,
  accepted: <CheckCircle className="w-4 h-4" />,
  rejected: <XCircle className="w-4 h-4" />,
  expired: <Clock className="w-4 h-4" />,
  revised: <FileSignature className="w-4 h-4" />,
};

interface QuoteWithCustomer extends Quote {
  customers?: { company_name: string | null; first_name: string | null; last_name: string } | null;
}

interface LineItem {
  id: string;
  position: number;
  description: string;
  unit: string;
  quantity: number;
  unit_price: number;
}

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<QuoteWithCustomer[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    customer_id: "",
    title: "",
    valid_days: "30",
    introduction: "",
    payment_terms: "Zahlbar innerhalb von 14 Tagen nach Rechnungsstellung.",
    notes: "",
  });
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: "1", position: 1, description: "", unit: "Stk", quantity: 1, unit_price: 0 },
  ]);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    
    const [quotesRes, customersRes] = await Promise.all([
      supabase
        .from("quotes")
        .select("*, customers(company_name, first_name, last_name)")
        .order("created_at", { ascending: false }),
      supabase
        .from("customers")
        .select("id, company_name, first_name, last_name")
        .eq("status", "active")
        .order("company_name"),
    ]);

    setQuotes(quotesRes.data || []);
    setCustomers(customersRes.data || []);
    setLoading(false);
  }

  const filtered = quotes.filter((q) => {
    const matchesSearch =
      !search ||
      q.title?.toLowerCase().includes(search.toLowerCase()) ||
      q.quote_number?.toLowerCase().includes(search.toLowerCase()) ||
      q.customers?.company_name?.toLowerCase().includes(search.toLowerCase()) ||
      q.customers?.last_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Stats
  const stats = {
    total: quotes.length,
    draft: quotes.filter((q) => q.status === "draft").length,
    sent: quotes.filter((q) => q.status === "sent").length,
    accepted: quotes.filter((q) => q.status === "accepted").length,
    totalValue: quotes
      .filter((q) => q.status === "accepted")
      .reduce((sum, q) => sum + (q.gross_amount || 0), 0),
  };

  function addLineItem() {
    setLineItems([
      ...lineItems,
      {
        id: Date.now().toString(),
        position: lineItems.length + 1,
        description: "",
        unit: "Stk",
        quantity: 1,
        unit_price: 0,
      },
    ]);
  }

  function removeLineItem(id: string) {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((item) => item.id !== id));
  }

  function updateLineItem(id: string, field: keyof LineItem, value: string | number) {
    setLineItems(
      lineItems.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  }

  function calculateTotals() {
    const netTotal = lineItems.reduce(
      (sum, item) => sum + item.quantity * item.unit_price,
      0
    );
    const taxAmount = netTotal * 0.19;
    const grossTotal = netTotal + taxAmount;
    return { netTotal, taxAmount, grossTotal };
  }

  function openNew() {
    setForm({
      customer_id: "",
      title: "",
      valid_days: "30",
      introduction: "Vielen Dank für Ihre Anfrage. Gerne unterbreiten wir Ihnen folgendes Angebot:",
      payment_terms: "Zahlbar innerhalb von 14 Tagen nach Rechnungsstellung.",
      notes: "",
    });
    setLineItems([
      { id: "1", position: 1, description: "", unit: "Stk", quantity: 1, unit_price: 0 },
    ]);
    setShowForm(true);
  }

  async function saveQuote(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customer_id || lineItems.every((item) => !item.description)) {
      alert("Bitte Kunde und mindestens eine Position ausfüllen.");
      return;
    }

    setSaving(true);

    const { netTotal, taxAmount, grossTotal } = calculateTotals();
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + parseInt(form.valid_days));

    // Generate quote number
    const year = new Date().getFullYear();
    const { count } = await supabase
      .from("quotes")
      .select("*", { count: "exact", head: true })
      .gte("created_at", `${year}-01-01`);

    const quoteNumber = `ANG-${year}-${String((count || 0) + 1).padStart(4, "0")}`;

    const { data, error } = await supabase
      .from("quotes")
      .insert({
        customer_id: form.customer_id,
        quote_number: quoteNumber,
        title: form.title || `Angebot ${quoteNumber}`,
        status: "draft",
        valid_until: validUntil.toISOString().split("T")[0],
        line_items: lineItems
          .filter((item) => item.description)
          .map((item, idx) => ({
            id: item.id,
            position: idx + 1,
            description: item.description,
            unit: item.unit,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.quantity * item.unit_price,
          })),
        net_amount: netTotal,
        tax_amount: taxAmount,
        gross_amount: grossTotal,
        tax_rate: 19,
        introduction: form.introduction || null,
        payment_terms: form.payment_terms || null,
        notes: form.notes || null,
      })
      .select("id")
      .single();

    setSaving(false);

    if (error) {
      alert("Fehler beim Speichern: " + error.message);
      return;
    }

    setShowForm(false);

    if (data) {
      router.push(`/quotes/${data.id}`);
    } else {
      await loadData();
    }
  }

  const totals = calculateTotals();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <FileSignature className="w-6 h-6 text-orange-400" />
          Angebote
          <span className="text-neutral-500 font-normal text-base ml-2">
            ({filtered.length})
          </span>
        </h1>
        <button onClick={openNew} className="btn btn-primary">
          <Plus className="w-4 h-4" />
          Neues Angebot
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-white">{stats.total}</p>
          <p className="text-xs text-neutral-500">Gesamt</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-yellow-400">{stats.draft}</p>
          <p className="text-xs text-neutral-500">Entwürfe</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-blue-400">{stats.sent}</p>
          <p className="text-xs text-neutral-500">Gesendet</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-green-400">
            {stats.totalValue.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
          </p>
          <p className="text-xs text-neutral-500">Angenommen</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            placeholder="Suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10 w-full"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input !w-auto"
        >
          <option value="">Alle Status</option>
          {Object.entries(statusLabels).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Quote List */}
      {loading ? (
        <div className="text-center py-12">
          <Spinner className="mx-auto" />
          <p className="text-neutral-500 mt-4">Lade Angebote...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <FileSignature className="w-12 h-12 mx-auto text-neutral-700 mb-3" />
          <p className="text-neutral-500">Keine Angebote gefunden</p>
          <p className="text-neutral-600 text-sm mt-1">Erstelle dein erstes Angebot</p>
        </div>
      ) : (
        <div className="card divide-y divide-[#1f1f1f]">
          {filtered.map((quote) => (
            <div
              key={quote.id}
              onClick={() => router.push(`/quotes/${quote.id}`)}
              className="list-item cursor-pointer group"
            >
              {/* Status */}
              <span className={`badge ${statusColors[quote.status || "draft"]} shrink-0 flex items-center gap-1`}>
                {statusIcons[quote.status || "draft"]}
                {statusLabels[quote.status || "draft"]}
              </span>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white truncate">{quote.title}</span>
                  <span className="text-xs text-neutral-500">{quote.quote_number}</span>
                </div>
                <div className="flex items-center gap-4 mt-1 text-sm text-neutral-400">
                  {quote.customers && (
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      {quote.customers.company_name || 
                        `${quote.customers.first_name || ""} ${quote.customers.last_name}`.trim()}
                    </span>
                  )}
                  <span>{formatDate(quote.created_at)}</span>
                  {quote.valid_until && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Gültig bis {formatDate(quote.valid_until)}
                    </span>
                  )}
                </div>
              </div>

              {/* Amount */}
              {quote.gross_amount && (
                <span className="text-green-400 font-bold shrink-0">
                  {quote.gross_amount.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                </span>
              )}

              {/* Arrow */}
              <ChevronRight className="w-5 h-5 text-neutral-600 shrink-0 group-hover:text-white transition-colors" />
            </div>
          ))}
        </div>
      )}

      {/* New Quote Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Neues Angebot">
        <form onSubmit={saveQuote} className="space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Customer & Title */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="form-label">Kunde *</label>
              <select
                value={form.customer_id}
                onChange={(e) => setForm({ ...form, customer_id: e.target.value })}
                className="input"
                required
              >
                <option value="">-- Kunde wählen --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name || `${c.first_name || ""} ${c.last_name}`.trim()}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="form-label">Gültigkeit (Tage)</label>
              <input
                type="number"
                value={form.valid_days}
                onChange={(e) => setForm({ ...form, valid_days: e.target.value })}
                className="input"
                min="1"
              />
            </div>
            <div className="col-span-2">
              <label className="form-label">Titel</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="input"
                placeholder="z.B. PV-Anlage 10kWp"
              />
            </div>
          </div>

          {/* Line Items */}
          <div className="border-t border-[#262626] pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-neutral-400">Positionen</h4>
              <button type="button" onClick={addLineItem} className="btn btn-ghost btn-sm">
                <Plus className="w-4 h-4" />
                Position
              </button>
            </div>

            <div className="space-y-3">
              {lineItems.map((item, idx) => (
                <div key={item.id} className="p-3 bg-[#111] rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-500">Position {idx + 1}</span>
                    {lineItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLineItem(item.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <input
                    value={item.description}
                    onChange={(e) => updateLineItem(item.id, "description", e.target.value)}
                    className="input"
                    placeholder="Beschreibung"
                  />
                  <div className="grid grid-cols-4 gap-2">
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(item.id, "quantity", parseFloat(e.target.value) || 0)}
                      className="input"
                      placeholder="Menge"
                      min="0"
                      step="0.01"
                    />
                    <input
                      value={item.unit}
                      onChange={(e) => updateLineItem(item.id, "unit", e.target.value)}
                      className="input"
                      placeholder="Einheit"
                    />
                    <input
                      type="number"
                      value={item.unit_price}
                      onChange={(e) => updateLineItem(item.id, "unit_price", parseFloat(e.target.value) || 0)}
                      className="input"
                      placeholder="Preis"
                      min="0"
                      step="0.01"
                    />
                    <div className="flex items-center justify-end text-green-400 font-medium">
                      {(item.quantity * item.unit_price).toLocaleString("de-DE", {
                        style: "currency",
                        currency: "EUR",
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="mt-4 p-3 bg-[#1a1a1a] rounded-lg space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-400">Netto</span>
                <span className="text-white">
                  {totals.netTotal.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">MwSt. (19%)</span>
                <span className="text-white">
                  {totals.taxAmount.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                </span>
              </div>
              <div className="flex justify-between font-bold text-base pt-2 border-t border-[#333]">
                <span className="text-white">Brutto</span>
                <span className="text-green-400">
                  {totals.grossTotal.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                </span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="form-label">Interne Notizen</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="input"
              placeholder="Nicht auf dem Angebot sichtbar..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button type="submit" disabled={saving} className="btn btn-primary flex-1">
              {saving ? <Spinner className="!w-5 !h-5" /> : <Plus className="w-4 h-4" />}
              {saving ? "Speichern..." : "Angebot erstellen"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary flex-1">
              Abbrechen
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
