"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import {
  Receipt,
  Clock,
  Eye,
  CheckCircle,
  Search,
  FileText,
  X,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type InvoiceStatus = "uploaded" | "reviewed" | "approved" | "paid";

interface PartnerInvoice {
  id: string;
  partner_id: string;
  project_id: string | null;
  invoice_number: string;
  invoice_date: string | null;
  file_url: string | null;
  amount: number;
  notes: string | null;
  status: InvoiceStatus;
  uploaded_at: string;
  partner: { company_name: string } | null;
  project: { id: string; name: string } | null;
}

interface Project {
  id: string;
  name: string;
}

interface QuoteItem {
  id: string;
  position_number: number;
  product_name: string;
  total_price: number;
}

interface AssignmentEntry {
  quote_line_item_key: string;
  amount: string;
  checked: boolean;
}

// ─── Status config ─────────────────────────────────────────────────────────────

const statusConfig: Record<
  InvoiceStatus,
  { label: string; icon: React.ElementType; cls: string }
> = {
  uploaded: {
    label: "Neu",
    icon: Clock,
    cls: "text-yellow-400 bg-yellow-500/20",
  },
  reviewed: {
    label: "Zugeordnet",
    icon: Eye,
    cls: "text-blue-400 bg-blue-500/20",
  },
  approved: {
    label: "Freigegeben",
    icon: CheckCircle,
    cls: "text-green-400 bg-green-500/20",
  },
  paid: {
    label: "Bezahlt",
    icon: CheckCircle,
    cls: "text-green-400 bg-green-500/20",
  },
};

type StatusFilter = "all" | "unassigned" | InvoiceStatus;

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Alle" },
  { key: "unassigned", label: "Unzugeordnet" },
  { key: "uploaded", label: "Neu" },
  { key: "reviewed", label: "In Prüfung" },
  { key: "approved", label: "Freigegeben" },
  { key: "paid", label: "Bezahlt" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

function formatDateShort(dateStr: string | null): string {
  if (!dateStr) return "–";
  return new Date(dateStr).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RechnungsInboxPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<PartnerInvoice[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  // PDF preview
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Assignment modal
  const [assignInvoice, setAssignInvoice] = useState<PartnerInvoice | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [assignments, setAssignments] = useState<AssignmentEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");

  // ── Load invoices ──────────────────────────────────────────────────────────

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("partner_invoices")
        .select(
          "*, partner:partners(company_name), project:projects(id, name)"
        )
        .order("uploaded_at", { ascending: false });

      if (error) {
        toast.error("Fehler beim Laden der Rechnungen");
        console.error(error);
      } else {
        setInvoices((data as PartnerInvoice[]) ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  // ── Load projects for assignment modal ────────────────────────────────────

  async function loadProjects() {
    const { data } = await supabase
      .from("projects")
      .select("id, name")
      .order("name");
    setProjects((data as Project[]) ?? []);
  }

  // ── Load quote items when project changes ─────────────────────────────────

  async function loadQuoteItems(projectId: string) {
    setLoadingItems(true);
    setQuoteItems([]);
    setAssignments([]);
    try {
      const { data: quoteData } = await supabase
        .from("wawi_quotes")
        .select("id")
        .eq("project_id", projectId)
        .eq("status", "accepted")
        .single();

      if (!quoteData) {
        toast.error("Kein akzeptiertes Angebot für dieses Projekt gefunden");
        setLoadingItems(false);
        return;
      }

      const { data: itemsData } = await supabase
        .from("wawi_quote_items")
        .select("id, position_number, product_name, total_price")
        .eq("quote_id", quoteData.id)
        .order("position_number");

      const items = (itemsData as QuoteItem[]) ?? [];
      setQuoteItems(items);
      setAssignments(
        items.map((item) => ({
          quote_line_item_key: item.id,
          amount: "",
          checked: false,
        }))
      );
    } finally {
      setLoadingItems(false);
    }
  }

  function openAssignModal(invoice: PartnerInvoice) {
    setAssignInvoice(invoice);
    setSelectedProjectId("");
    setQuoteItems([]);
    setAssignments([]);
    setProjectSearch("");
    loadProjects();
  }

  function closeAssignModal() {
    setAssignInvoice(null);
    setSelectedProjectId("");
    setQuoteItems([]);
    setAssignments([]);
    setProjectSearch("");
  }

  async function handleProjectSelect(projectId: string) {
    setSelectedProjectId(projectId);
    if (projectId) {
      await loadQuoteItems(projectId);
    }
  }

  function toggleAssignment(index: number) {
    setAssignments((prev) =>
      prev.map((a, i) => (i === index ? { ...a, checked: !a.checked } : a))
    );
  }

  function setAssignmentAmount(index: number, value: string) {
    setAssignments((prev) =>
      prev.map((a, i) => (i === index ? { ...a, amount: value } : a))
    );
  }

  // Computed sum of checked assignments
  const assignedSum = assignments
    .filter((a) => a.checked)
    .reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);

  const invoiceAmount = assignInvoice?.amount ?? 0;
  const sumMismatch =
    assignedSum > 0 && Math.abs(assignedSum - invoiceAmount) > 0.01;

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!assignInvoice || !selectedProjectId) return;

    const checkedAssignments = assignments.filter(
      (a) => a.checked && parseFloat(a.amount) > 0
    );

    if (checkedAssignments.length === 0) {
      toast.error("Bitte mindestens eine Position auswählen und Betrag eingeben");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign_invoice",
          invoice_id: assignInvoice.id,
          project_id: selectedProjectId,
          assignments: checkedAssignments.map((a) => {
            const qi = quoteItems.find((q) => q.id === a.quote_line_item_key);
            return {
              quote_line_item_key: a.quote_line_item_key,
              amount: parseFloat(a.amount),
              description: qi
                ? `${qi.position_number}. ${qi.product_name}`
                : "Rechnung",
            };
          }),
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Fehler beim Zuordnen");
      } else {
        toast.success("Rechnung zugeordnet");
        closeAssignModal();
        await loadInvoices();
      }
    } catch {
      toast.error("Netzwerk-Fehler");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Filtering ──────────────────────────────────────────────────────────────

  const filtered = invoices.filter((inv) => {
    if (statusFilter === "unassigned") {
      if (inv.project_id) return false;
    } else if (statusFilter !== "all") {
      if (inv.status !== statusFilter) return false;
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      const partnerName = inv.partner?.company_name.toLowerCase() ?? "";
      const invoiceNum = inv.invoice_number.toLowerCase();
      if (!partnerName.includes(q) && !invoiceNum.includes(q)) return false;
    }

    return true;
  });

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(projectSearch.toLowerCase())
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Receipt className="w-6 h-6 text-[#fa432a]" />
          Rechnungs-Inbox
        </h1>
        <p className="text-neutral-500 text-sm mt-1">
          Unzugeordnete Rechnungen von Partnern
        </p>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        {/* Status filter pills */}
        <div className="flex flex-wrap gap-2 flex-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                statusFilter === f.key
                  ? "bg-[#fa432a] text-white"
                  : "bg-[#111] text-neutral-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Partner oder Re-Nr..."
            className="input w-full pl-9 text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-neutral-500">
            <Receipt className="w-12 h-12 mx-auto mb-3 text-neutral-700" />
            <p>Keine Rechnungen gefunden</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-800">
                  <th className="text-left text-xs text-neutral-500 uppercase py-3 px-4 font-medium">
                    Status
                  </th>
                  <th className="text-left text-xs text-neutral-500 uppercase py-3 px-4 font-medium">
                    Partner
                  </th>
                  <th className="text-left text-xs text-neutral-500 uppercase py-3 px-4 font-medium hidden sm:table-cell">
                    Re-Nr
                  </th>
                  <th className="text-right text-xs text-neutral-500 uppercase py-3 px-4 font-medium">
                    Betrag
                  </th>
                  <th className="text-left text-xs text-neutral-500 uppercase py-3 px-4 font-medium hidden md:table-cell">
                    Datum
                  </th>
                  <th className="text-left text-xs text-neutral-500 uppercase py-3 px-4 font-medium hidden lg:table-cell">
                    Projekt
                  </th>
                  <th className="w-28 py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => {
                  const cfg = statusConfig[inv.status] ?? statusConfig.uploaded;
                  const StatusIcon = cfg.icon;

                  return (
                    <tr
                      key={inv.id}
                      className="border-b border-neutral-800/50 hover:bg-white/[0.02] transition-colors cursor-pointer"
                      onClick={() => inv.file_url && setPreviewUrl(inv.file_url)}
                    >
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md font-medium ${cfg.cls}`}
                        >
                          <StatusIcon className="w-3.5 h-3.5" />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-white text-sm">
                          {inv.partner?.company_name ?? "–"}
                        </span>
                        <div className="text-xs text-neutral-500 sm:hidden">
                          {inv.invoice_number}
                        </div>
                      </td>
                      <td className="py-3 px-4 hidden sm:table-cell">
                        <span className="text-neutral-300 text-sm font-mono">
                          {inv.invoice_number}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-white font-semibold text-sm">
                          {fmt.format(inv.amount)}
                        </span>
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell">
                        <span className="text-neutral-400 text-sm">
                          {formatDateShort(inv.invoice_date)}
                        </span>
                      </td>
                      <td className="py-3 px-4 hidden lg:table-cell">
                        <span className="text-neutral-400 text-sm">
                          {inv.project?.name ?? (
                            <span className="text-neutral-600">–</span>
                          )}
                        </span>
                      </td>
                      <td
                        className="py-3 px-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-2">
                          {inv.file_url && (
                            <button
                              onClick={() => setPreviewUrl(inv.file_url!)}
                              className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-white/5 transition-colors"
                              title="Vorschau"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                          )}
                          {inv.status === "uploaded" ? (
                            <button
                              onClick={() => openAssignModal(inv)}
                              className="btn-primary btn-sm text-xs"
                            >
                              Zuordnen
                            </button>
                          ) : (
                            <button
                              onClick={() => openAssignModal(inv)}
                              className="btn-secondary btn-sm text-xs"
                            >
                              Details
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary row */}
      {!loading && filtered.length > 0 && (
        <div className="text-sm text-neutral-500 text-right">
          {filtered.length} Rechnung{filtered.length !== 1 ? "en" : ""} &middot;{" "}
          Gesamt:{" "}
          <span className="text-white font-semibold">
            {fmt.format(filtered.reduce((s, i) => s + i.amount, 0))}
          </span>
        </div>
      )}

      {/* PDF Preview Modal */}
      <Modal
        open={!!previewUrl}
        onClose={() => setPreviewUrl(null)}
        title="Rechnungs-Vorschau"
      >
        <div className="w-full h-[70vh]">
          {previewUrl && (
            <iframe
              src={previewUrl}
              className="w-full h-full rounded-lg border border-neutral-800"
              title="Rechnung"
            />
          )}
        </div>
      </Modal>

      {/* Assignment Modal */}
      <Modal
        open={!!assignInvoice}
        onClose={closeAssignModal}
        title="Rechnung zuordnen"
      >
        {assignInvoice && (
          <form onSubmit={handleAssign} className="space-y-5">
            {/* Invoice summary */}
            <div className="p-3 rounded-lg bg-[#111] text-sm">
              <div className="font-semibold text-white">
                {assignInvoice.partner?.company_name ?? "–"}
              </div>
              <div className="text-neutral-400 mt-0.5">
                {assignInvoice.invoice_number} &middot;{" "}
                <span className="text-[#fa432a] font-semibold">
                  {fmt.format(assignInvoice.amount)}
                </span>
              </div>
            </div>

            {/* Project selection */}
            <div>
              <label className="block text-sm text-neutral-400 mb-2">
                Projekt
              </label>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input
                  type="text"
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  placeholder="Projekt suchen..."
                  className="input w-full pl-9 text-sm"
                />
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1 rounded-lg border border-neutral-800 p-1 bg-[#0d0d0d]">
                {filteredProjects.length === 0 ? (
                  <p className="text-neutral-600 text-sm p-2">
                    Keine Projekte gefunden
                  </p>
                ) : (
                  filteredProjects.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleProjectSelect(p.id)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                        selectedProjectId === p.id
                          ? "bg-[#fa432a]/20 text-[#fa432a]"
                          : "text-neutral-300 hover:bg-white/5"
                      }`}
                    >
                      {p.name}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Quote positions */}
            {selectedProjectId && (
              <div>
                <label className="block text-sm text-neutral-400 mb-2">
                  Positionen
                </label>
                {loadingItems ? (
                  <div className="flex items-center justify-center py-6">
                    <Spinner />
                  </div>
                ) : quoteItems.length === 0 ? (
                  <p className="text-neutral-500 text-sm text-center py-4">
                    Kein akzeptiertes Angebot gefunden
                  </p>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {quoteItems.map((item, idx) => {
                      const entry = assignments[idx];
                      if (!entry) return null;
                      return (
                        <div
                          key={item.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                            entry.checked
                              ? "border-[#fa432a]/40 bg-[#fa432a]/5"
                              : "border-neutral-800 bg-[#111]"
                          }`}
                        >
                          <input
                            type="checkbox"
                            id={`pos-${item.id}`}
                            checked={entry.checked}
                            onChange={() => toggleAssignment(idx)}
                            className="w-4 h-4 accent-[#fa432a] cursor-pointer flex-shrink-0"
                          />
                          <label
                            htmlFor={`pos-${item.id}`}
                            className="flex-1 text-sm cursor-pointer"
                          >
                            <span className="text-neutral-500 mr-1.5">
                              {item.position_number}.
                            </span>
                            <span className="text-white">{item.product_name}</span>
                            <span className="text-neutral-600 text-xs ml-2">
                              ({fmt.format(item.total_price)})
                            </span>
                          </label>
                          <input
                            type="number"
                            value={entry.amount}
                            onChange={(e) =>
                              setAssignmentAmount(idx, e.target.value)
                            }
                            placeholder="0,00"
                            step="0.01"
                            min="0"
                            disabled={!entry.checked}
                            className="input w-28 text-right text-sm disabled:opacity-40"
                          />
                          <span className="text-neutral-500 text-xs">€</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Sum row */}
                {quoteItems.length > 0 && (
                  <div
                    className={`mt-3 flex items-center justify-between text-sm p-3 rounded-lg ${
                      sumMismatch
                        ? "bg-yellow-500/10 border border-yellow-500/30"
                        : "bg-[#111]"
                    }`}
                  >
                    <span className="text-neutral-400 flex items-center gap-1.5">
                      {sumMismatch && (
                        <AlertTriangle className="w-4 h-4 text-yellow-400" />
                      )}
                      Summe zugeordnet
                    </span>
                    <span
                      className={`font-semibold ${
                        sumMismatch ? "text-yellow-400" : "text-white"
                      }`}
                    >
                      {fmt.format(assignedSum)}
                      {sumMismatch && (
                        <span className="text-yellow-500/70 font-normal ml-1 text-xs">
                          (Rg: {fmt.format(invoiceAmount)})
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={closeAssignModal}
                className="btn-secondary flex-1"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={
                  submitting ||
                  !selectedProjectId ||
                  assignments.filter(
                    (a) => a.checked && parseFloat(a.amount) > 0
                  ).length === 0
                }
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {submitting && <Spinner className="w-4 h-4" />}
                Zuordnen
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
