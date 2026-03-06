"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import { Modal } from "@/components/ui/modal";
import { toast } from "sonner";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  CheckCircle,
  AlertTriangle,
  FileText,
  Package,
  Building2,
  MoreHorizontal,
  Receipt,
  type LucideIcon,
} from "lucide-react";
import type {
  ProjectCostSummary,
  PositionCostSummary,
  CostType,
  ProjectCalculationStatus,
} from "@/types/nachkalkulation";

interface NachkalkulationTabProps {
  projectId: string;
  quoteId?: string;
}

// -----------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------

const costTypeLabels: Record<CostType, { label: string; icon: LucideIcon }> = {
  subcontractor_invoice: { label: "Sub-Rechnung", icon: FileText },
  material: { label: "Material", icon: Package },
  overhead: { label: "Gemeinkosten", icon: Building2 },
  other: { label: "Sonstiges", icon: MoreHorizontal },
};

const calcStatusLabels: Record<string, { label: string; color: string }> = {
  open: { label: "Offen", color: "text-yellow-400 bg-yellow-500/20" },
  in_review: { label: "In Prüfung", color: "text-blue-400 bg-blue-500/20" },
  closed: { label: "Abgeschlossen", color: "text-green-400 bg-green-500/20" },
};

const currency = (value: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);

const today = () => new Date().toISOString().slice(0, 10);

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

interface Subcontractor {
  id: string;
  company_name: string;
}

interface CostForm {
  cost_type: CostType;
  description: string;
  amount: string;
  date: string;
  quote_line_item_key: string;
  subcontractor_id: string;
  notes: string;
}

const emptyCostForm = (): CostForm => ({
  cost_type: "other",
  description: "",
  amount: "",
  date: today(),
  quote_line_item_key: "",
  subcontractor_id: "",
  notes: "",
});

// -----------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------

export function NachkalkulationTab({ projectId }: NachkalkulationTabProps) {
  const supabase = createClient();

  const [summary, setSummary] = useState<ProjectCostSummary | null>(null);
  const [calcStatus, setCalcStatus] = useState<ProjectCalculationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Subcontractors for the cost form
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);

  // Modals
  const [showCostModal, setShowCostModal] = useState(false);
  const [costForm, setCostForm] = useState<CostForm>(emptyCostForm());
  const [savingCost, setSavingCost] = useState(false);

  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closing, setClosing] = useState(false);

  // Status dropdown
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // -----------------------------------------------------------------------
  // Data loading
  // -----------------------------------------------------------------------

  async function loadSummary() {
    try {
      const res = await fetch("/api/costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "summary", project_id: projectId }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setSummary(json.data as ProjectCostSummary);
    } catch (err) {
      console.error("[NachkalkulationTab] loadSummary error:", err);
      toast.error("Fehler beim Laden der Kostenzusammenfassung");
    }
  }

  async function loadCalcStatus() {
    try {
      const res = await fetch("/api/calculation-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get", project_id: projectId }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setCalcStatus(json.data as ProjectCalculationStatus);
    } catch (err) {
      console.error("[NachkalkulationTab] loadCalcStatus error:", err);
    }
  }

  async function loadSubcontractors() {
    try {
      const { data } = await supabase
        .from("subcontractors")
        .select("id, company_name")
        .order("company_name", { ascending: true });
      setSubcontractors(data ?? []);
    } catch (err) {
      console.error("[NachkalkulationTab] loadSubcontractors error:", err);
    }
  }

  useEffect(() => {
    async function init() {
      setLoading(true);
      await Promise.all([loadSummary(), loadCalcStatus(), loadSubcontractors()]);
      setLoading(false);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // -----------------------------------------------------------------------
  // Interactions
  // -----------------------------------------------------------------------

  function toggleRow(key: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  async function handleStatusChange(newStatus: string) {
    setUpdatingStatus(true);
    setShowStatusDropdown(false);
    try {
      const res = await fetch("/api/calculation-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", project_id: projectId, status: newStatus }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setCalcStatus(json.data);
      toast.success("Status aktualisiert");
    } catch (err) {
      console.error("[NachkalkulationTab] handleStatusChange error:", err);
      toast.error("Fehler beim Aktualisieren des Status");
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleSaveCost(e: React.FormEvent) {
    e.preventDefault();
    if (!costForm.description.trim() || !costForm.amount) return;
    setSavingCost(true);
    try {
      const payload: Record<string, unknown> = {
        action: "create",
        project_id: projectId,
        cost_type: costForm.cost_type,
        description: costForm.description.trim(),
        amount: parseFloat(costForm.amount),
        date: costForm.date,
      };
      if (costForm.quote_line_item_key) payload.quote_line_item_key = costForm.quote_line_item_key;
      if (costForm.subcontractor_id) payload.subcontractor_id = costForm.subcontractor_id;
      if (costForm.notes.trim()) payload.notes = costForm.notes.trim();

      const res = await fetch("/api/costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      toast.success("Kosten gespeichert");
      setShowCostModal(false);
      setCostForm(emptyCostForm());
      await loadSummary();
    } catch (err) {
      console.error("[NachkalkulationTab] handleSaveCost error:", err);
      toast.error("Fehler beim Speichern der Kosten");
    } finally {
      setSavingCost(false);
    }
  }

  async function handleClose() {
    setClosing(true);
    try {
      const res = await fetch("/api/calculation-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", project_id: projectId, status: "closed" }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setCalcStatus(json.data);
      toast.success("Nachkalkulation abgeschlossen");
      setShowCloseModal(false);
    } catch (err) {
      console.error("[NachkalkulationTab] handleClose error:", err);
      toast.error("Fehler beim Abschließen");
    } finally {
      setClosing(false);
    }
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  function differenzColor(value: number) {
    if (value > 0) return "text-green-400";
    if (value < 0) return "text-red-400";
    return "text-neutral-400";
  }

  function differenzIcon(value: number) {
    if (value > 0) return <CheckCircle className="w-4 h-4 text-green-400 inline ml-1" />;
    if (value < 0) return <AlertTriangle className="w-4 h-4 text-yellow-400 inline ml-1" />;
    return <CheckCircle className="w-4 h-4 text-green-400 inline ml-1" />;
  }

  function differenzLabel(value: number) {
    const sign = value > 0 ? "+" : "";
    return `${sign}${currency(value)}`;
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Spinner />
      </div>
    );
  }

  const currentStatus = calcStatus?.status ?? "open";
  const statusConfig = calcStatusLabels[currentStatus] ?? calcStatusLabels.open;
  const openItemsCount = summary?.open_items?.length ?? 0;
  const isClosed = currentStatus === "closed";

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Receipt className="w-5 h-5 text-neutral-400" />
          <h3 className="text-lg font-semibold">Nachkalkulation</h3>
        </div>

        {/* Status dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowStatusDropdown((v) => !v)}
            disabled={updatingStatus}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border border-transparent ${statusConfig.color} hover:opacity-80`}
          >
            <span className="w-2 h-2 rounded-full bg-current" />
            {statusConfig.label}
            <ChevronDown className="w-3 h-3" />
          </button>

          {showStatusDropdown && (
            <div className="absolute right-0 top-full mt-1 z-20 bg-[#1a1a1a] border border-neutral-700 rounded-lg shadow-xl min-w-36 py-1">
              {Object.entries(calcStatusLabels).map(([key, cfg]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleStatusChange(key)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-neutral-800 transition-colors ${cfg.color.split(" ")[0]}`}
                >
                  {cfg.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Summary table */}
      {summary ? (
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-800">
                <th className="py-3 px-4 text-left text-xs text-neutral-500 font-medium">Position</th>
                <th className="py-3 px-4 text-right text-xs text-neutral-500 font-medium">Soll</th>
                <th className="py-3 px-4 text-right text-xs text-neutral-500 font-medium">Ist</th>
                <th className="py-3 px-4 text-right text-xs text-neutral-500 font-medium">Differenz</th>
              </tr>
            </thead>
            <tbody>
              {summary.positions.map((pos: PositionCostSummary) => {
                const isExpanded = expandedRows.has(pos.line_item_key);
                const hasCosts = pos.costs.length > 0;

                return (
                  <>
                    {/* Position row */}
                    <tr
                      key={pos.line_item_key}
                      className="border-b border-neutral-800 hover:bg-neutral-900/50 cursor-pointer transition-colors"
                      onClick={() => toggleRow(pos.line_item_key)}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {hasCosts ? (
                            isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-neutral-500 shrink-0" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-neutral-500 shrink-0" />
                            )
                          ) : (
                            <span className="w-4 h-4 shrink-0" />
                          )}
                          <span className="text-sm text-neutral-300">
                            {pos.position_number !== 9999
                              ? `${pos.position_number}. ${pos.product_name}`
                              : pos.product_name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right text-sm text-neutral-400 tabular-nums">
                        {pos.soll > 0 ? currency(pos.soll) : "–"}
                      </td>
                      <td className="py-3 px-4 text-right text-sm text-white tabular-nums">
                        {currency(pos.ist)}
                      </td>
                      <td className="py-3 px-4 text-right text-sm tabular-nums">
                        <span className={differenzColor(pos.differenz)}>
                          {differenzLabel(pos.differenz)}
                        </span>
                        {differenzIcon(pos.differenz)}
                      </td>
                    </tr>

                    {/* Expanded cost entries */}
                    {isExpanded &&
                      pos.costs.map((cost) => {
                        const typeConfig = costTypeLabels[cost.cost_type] ?? costTypeLabels.other;
                        const TypeIcon = typeConfig.icon;
                        return (
                          <tr
                            key={cost.id}
                            className="border-b border-neutral-800/50 bg-neutral-900/30"
                          >
                            <td className="py-2 px-4 pl-10" colSpan={2}>
                              <div className="flex items-center gap-2 text-xs text-neutral-400">
                                <TypeIcon className="w-3.5 h-3.5 shrink-0" />
                                <span>
                                  {cost.subcontractor?.company_name
                                    ? `${cost.subcontractor.company_name} – `
                                    : ""}
                                  {cost.description}
                                </span>
                              </div>
                            </td>
                            <td className="py-2 px-4 text-right text-xs text-neutral-400 tabular-nums">
                              {currency(cost.amount)}
                            </td>
                            <td />
                          </tr>
                        );
                      })}
                  </>
                );
              })}

              {/* Zwischensumme */}
              <tr className="border-b border-neutral-700 bg-neutral-900/50">
                <td className="py-3 px-4 text-sm font-medium text-neutral-300 pl-10">
                  Zwischensumme
                </td>
                <td className="py-3 px-4 text-right text-sm font-medium text-neutral-300 tabular-nums">
                  {currency(summary.quote_total)}
                </td>
                <td className="py-3 px-4 text-right text-sm font-medium text-white tabular-nums">
                  {currency(summary.total_costs)}
                </td>
                <td className="py-3 px-4 text-right text-sm tabular-nums">
                  <span className={differenzColor(summary.quote_total - summary.total_costs)}>
                    {differenzLabel(summary.quote_total - summary.total_costs)}
                  </span>
                </td>
              </tr>

              {/* Gemeinkosten */}
              {summary.overhead_amount > 0 && (
                <tr className="border-b border-neutral-800">
                  <td className="py-2 px-4 text-sm text-neutral-500 pl-10" colSpan={2}>
                    Gemeinkosten
                  </td>
                  <td className="py-2 px-4 text-right text-sm text-neutral-400 tabular-nums" />
                  <td className="py-2 px-4 text-right text-sm text-neutral-400 tabular-nums">
                    {currency(summary.overhead_amount)}
                  </td>
                </tr>
              )}

              {/* Gesamtkosten */}
              <tr className="border-b border-neutral-700">
                <td className="py-3 px-4 text-sm font-semibold text-white pl-10" colSpan={3}>
                  Gesamtkosten
                </td>
                <td className="py-3 px-4 text-right text-sm font-semibold text-white tabular-nums">
                  {currency(summary.total_costs + summary.overhead_amount)}
                </td>
              </tr>

              {/* Gewinn */}
              <tr className="border-b border-neutral-800">
                <td className="py-3 px-4 text-sm text-neutral-400 pl-10" colSpan={3}>
                  Gewinn
                </td>
                <td className="py-3 px-4 text-right text-sm tabular-nums">
                  <span className={differenzColor(summary.profit)}>
                    {differenzLabel(summary.profit)}
                  </span>
                  {summary.profit < 0 && (
                    <AlertTriangle className="w-4 h-4 text-yellow-400 inline ml-1" />
                  )}
                </td>
              </tr>

              {/* Marge */}
              <tr>
                <td className="py-3 px-4 text-sm text-neutral-400 pl-10" colSpan={3}>
                  Marge
                </td>
                <td className="py-3 px-4 text-right text-sm tabular-nums">
                  <span className={differenzColor(summary.margin_percent)}>
                    {summary.margin_percent.toFixed(1).replace(".", ",")} %
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card p-8 text-center text-neutral-500">
          <Receipt className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>Noch keine Kostendaten vorhanden</p>
        </div>
      )}

      {/* Open items */}
      {openItemsCount > 0 && (
        <div className="card p-4 border border-yellow-500/20 bg-yellow-500/5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-medium text-yellow-400">
              Offene Posten ({openItemsCount})
            </span>
          </div>
          <ul className="space-y-1">
            {summary?.open_items.map((item, idx) => (
              <li key={idx} className="text-sm text-neutral-400">
                • {item.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <button
          type="button"
          onClick={() => {
            setCostForm(emptyCostForm());
            setShowCostModal(true);
          }}
          disabled={isClosed}
          className="btn btn-secondary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Kosten erfassen
        </button>

        {!isClosed && (
          <button
            type="button"
            onClick={() => setShowCloseModal(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            Abschließen
          </button>
        )}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Modal: Kosten erfassen                                             */}
      {/* ----------------------------------------------------------------- */}
      <Modal
        open={showCostModal}
        onClose={() => setShowCostModal(false)}
        title="Kosten erfassen"
        size="md"
      >
        <form onSubmit={handleSaveCost} className="space-y-4">
          {/* Cost type selector */}
          <div>
            <label className="label">Kostenart</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(costTypeLabels) as CostType[]).map((type) => {
                const cfg = costTypeLabels[type];
                const Icon = cfg.icon;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setCostForm({ ...costForm, cost_type: type })}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm transition-all ${
                      costForm.cost_type === type
                        ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-white"
                        : "border-[#262626] text-neutral-400 hover:border-[#333]"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="label">Beschreibung *</label>
            <input
              type="text"
              className="input"
              value={costForm.description}
              onChange={(e) => setCostForm({ ...costForm, description: e.target.value })}
              required
            />
          </div>

          {/* Amount + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Betrag (€) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input"
                value={costForm.amount}
                onChange={(e) => setCostForm({ ...costForm, amount: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Datum *</label>
              <input
                type="date"
                className="input"
                value={costForm.date}
                onChange={(e) => setCostForm({ ...costForm, date: e.target.value })}
                required
              />
            </div>
          </div>

          {/* Position */}
          {summary && summary.positions.length > 0 && (
            <div>
              <label className="label">Position</label>
              <select
                className="input"
                value={costForm.quote_line_item_key}
                onChange={(e) =>
                  setCostForm({ ...costForm, quote_line_item_key: e.target.value })
                }
              >
                <option value="">Ohne Zuordnung</option>
                {summary.positions
                  .filter((p) => p.line_item_key !== "unassigned")
                  .map((p) => (
                    <option key={p.line_item_key} value={p.line_item_key}>
                      {p.position_number}. {p.product_name}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Subcontractor (optional) */}
          {subcontractors.length > 0 && (
            <div>
              <label className="label">Subunternehmer (optional)</label>
              <select
                className="input"
                value={costForm.subcontractor_id}
                onChange={(e) =>
                  setCostForm({ ...costForm, subcontractor_id: e.target.value })
                }
              >
                <option value="">– keiner –</option>
                {subcontractors.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.company_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="label">Notizen (optional)</label>
            <textarea
              className="input min-h-[80px] resize-none"
              value={costForm.notes}
              onChange={(e) => setCostForm({ ...costForm, notes: e.target.value })}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              className="btn btn-primary flex-1"
              disabled={savingCost}
            >
              {savingCost ? <Spinner className="w-4 h-4" /> : "Speichern"}
            </button>
            <button
              type="button"
              onClick={() => setShowCostModal(false)}
              className="btn btn-secondary flex-1"
            >
              Abbrechen
            </button>
          </div>
        </form>
      </Modal>

      {/* ----------------------------------------------------------------- */}
      {/* Modal: Abschließen bestätigen                                      */}
      {/* ----------------------------------------------------------------- */}
      <Modal
        open={showCloseModal}
        onClose={() => setShowCloseModal(false)}
        title="Nachkalkulation abschließen"
        size="sm"
      >
        <div className="space-y-4">
          {openItemsCount > 0 && (
            <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
                <span className="text-sm font-medium text-yellow-400">
                  {openItemsCount} offene Posten vorhanden
                </span>
              </div>
              <ul className="space-y-1">
                {summary?.open_items.slice(0, 3).map((item, idx) => (
                  <li key={idx} className="text-xs text-neutral-400">
                    • {item.description}
                  </li>
                ))}
                {openItemsCount > 3 && (
                  <li className="text-xs text-neutral-500">
                    … und {openItemsCount - 3} weitere
                  </li>
                )}
              </ul>
            </div>
          )}

          <p className="text-sm text-neutral-400">
            Die Nachkalkulation wird als abgeschlossen markiert. Dieser Schritt kann
            jederzeit rückgängig gemacht werden.
          </p>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={closing}
              className="btn btn-primary flex-1"
            >
              {closing ? <Spinner className="w-4 h-4" /> : "Abschließen"}
            </button>
            <button
              type="button"
              onClick={() => setShowCloseModal(false)}
              className="btn btn-secondary flex-1"
            >
              Abbrechen
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
