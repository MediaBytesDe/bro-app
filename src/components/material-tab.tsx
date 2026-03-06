"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/spinner";
import { Modal } from "@/components/ui/modal";
import { toast } from "sonner";
import {
  Package,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  Search,
} from "lucide-react";
import type { MaterialMovement } from "@/types/nachkalkulation";

interface MaterialTabProps {
  projectId: string;
}

type ProductSearchResult = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  purchase_list_price: number;
  stock_quantity: number;
};

type Subcontractor = {
  id: string;
  company_name: string;
};

type SummaryRow = {
  product_id: string;
  product_name: string;
  sku: string;
  unit: string;
  total_outgoing: number;
  total_returning: number;
  net_consumption: number;
  cost: number;
};

const currencyFmt = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

function formatMovementDate(dateStr: string): string {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.`;
}

export function MaterialTab({ projectId }: MaterialTabProps) {
  const supabase = createClient();

  const [movements, setMovements] = useState<MaterialMovement[]>([]);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showOutgoing, setShowOutgoing] = useState(false);
  const [showReturning, setShowReturning] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Product search for outgoing modal
  const [productSearch, setProductSearch] = useState("");
  const [productResults, setProductResults] = useState<ProductSearchResult[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductSearchResult | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Subcontractors
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);

  // Outgoing form
  const [outForm, setOutForm] = useState({
    quantity: "",
    subcontractor_id: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  // Returning form
  const [retForm, setRetForm] = useState({
    product_id: "",
    quantity: "",
    subcontractor_id: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, summaryRes] = await Promise.all([
        fetch("/api/material", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list", project_id: projectId }),
        }),
        fetch("/api/material", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "project_summary", project_id: projectId }),
        }),
      ]);

      const listJson = await listRes.json();
      const summaryJson = await summaryRes.json();

      if (listJson.data) setMovements(listJson.data);
      if (summaryJson.data) setSummary(summaryJson.data);
    } catch (err) {
      console.error("MaterialTab load error:", err);
      toast.error("Fehler beim Laden der Materialdaten");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const loadSubcontractors = useCallback(async () => {
    const { data } = await supabase
      .from("subcontractors")
      .select("id, company_name")
      .order("company_name");
    if (data) setSubcontractors(data as Subcontractor[]);
  }, [supabase]);

  useEffect(() => {
    loadData();
    loadSubcontractors();
  }, [loadData, loadSubcontractors]);

  // Product search with debounce
  useEffect(() => {
    if (!showOutgoing) return;
    if (selectedProduct) return;

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!productSearch.trim()) {
      setProductResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const { data } = await supabase
          .from("products")
          .select("id, name, sku, unit, purchase_list_price, stock_quantity")
          .or(`name.ilike.%${productSearch}%,sku.ilike.%${productSearch}%`)
          .eq("status", "active")
          .limit(10);
        setProductResults((data as ProductSearchResult[]) ?? []);
      } catch {
        setProductResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [productSearch, showOutgoing, selectedProduct, supabase]);

  function resetOutForm() {
    setOutForm({
      quantity: "",
      subcontractor_id: "",
      date: new Date().toISOString().split("T")[0],
      notes: "",
    });
    setSelectedProduct(null);
    setProductSearch("");
    setProductResults([]);
  }

  function resetRetForm() {
    setRetForm({
      product_id: "",
      quantity: "",
      subcontractor_id: "",
      date: new Date().toISOString().split("T")[0],
      notes: "",
    });
  }

  async function handleOutgoingSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProduct) {
      toast.error("Bitte ein Produkt auswählen");
      return;
    }
    const qty = Number(outForm.quantity);
    if (!qty || qty <= 0) {
      toast.error("Ungültige Menge");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/material", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          direction: "outgoing",
          product_id: selectedProduct.id,
          project_id: projectId,
          quantity: qty,
          subcontractor_id: outForm.subcontractor_id || undefined,
          date: outForm.date || undefined,
          notes: outForm.notes || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Fehler beim Speichern");
      toast.success("Ausgabe erfasst");
      setShowOutgoing(false);
      resetOutForm();
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Speichern");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReturningSubmit(e: React.FormEvent) {
    e.preventDefault();
    const qty = Number(retForm.quantity);
    if (!retForm.product_id) {
      toast.error("Bitte ein Produkt auswählen");
      return;
    }
    if (!qty || qty <= 0) {
      toast.error("Ungültige Menge");
      return;
    }

    const summaryRow = summary.find((s) => s.product_id === retForm.product_id);
    if (summaryRow && qty > summaryRow.net_consumption) {
      toast.error(
        `Maximale Rückgabemenge: ${summaryRow.net_consumption} ${summaryRow.unit}`
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/material", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          direction: "returning",
          product_id: retForm.product_id,
          project_id: projectId,
          quantity: qty,
          subcontractor_id: retForm.subcontractor_id || undefined,
          date: retForm.date || undefined,
          notes: retForm.notes || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Fehler beim Speichern");
      toast.success("Rückgabe erfasst");
      setShowReturning(false);
      resetRetForm();
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Speichern");
    } finally {
      setSubmitting(false);
    }
  }

  const totalCost = summary.reduce((sum, row) => sum + row.cost, 0);
  const returnableProducts = summary.filter((s) => s.net_consumption > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Package className="w-5 h-5 text-neutral-400" />
          Material
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => {
              resetOutForm();
              setShowOutgoing(true);
            }}
            className="btn btn-primary btn-sm"
          >
            <Plus className="w-4 h-4 mr-1" />
            Ausgabe
          </button>
          <button
            onClick={() => {
              resetRetForm();
              setShowReturning(true);
            }}
            className="btn btn-ghost btn-sm"
            disabled={returnableProducts.length === 0}
          >
            <Plus className="w-4 h-4 mr-1" />
            Rückgabe
          </button>
        </div>
      </div>

      {/* Consumption Summary */}
      {summary.length > 0 && (
        <div className="card p-4">
          <h4 className="text-sm font-semibold text-neutral-300 mb-3">
            Verbrauch Übersicht
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-neutral-500 border-b border-neutral-800">
                  <th className="text-left pb-2 pr-4">Artikel</th>
                  <th className="text-right pb-2 px-3">Ausgabe</th>
                  <th className="text-right pb-2 px-3">Rückgabe</th>
                  <th className="text-right pb-2 px-3">Verbrauch</th>
                  <th className="text-right pb-2 pl-3">Kosten</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((row) => (
                  <tr
                    key={row.product_id}
                    className="border-b border-neutral-800/50 last:border-0"
                  >
                    <td className="py-2 pr-4 text-white">{row.product_name}</td>
                    <td className="py-2 px-3 text-right text-neutral-300">
                      {row.total_outgoing} {row.unit}
                    </td>
                    <td className="py-2 px-3 text-right text-neutral-300">
                      {row.total_returning} {row.unit}
                    </td>
                    <td className="py-2 px-3 text-right font-medium text-white">
                      {row.net_consumption} {row.unit}
                    </td>
                    <td className="py-2 pl-3 text-right text-white">
                      {currencyFmt.format(row.cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-neutral-700">
                  <td
                    colSpan={4}
                    className="pt-2 text-sm font-medium text-neutral-400"
                  >
                    Materialkosten gesamt:
                  </td>
                  <td className="pt-2 text-right font-bold text-white">
                    {currencyFmt.format(totalCost)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Movements list */}
      <div className="card p-4">
        <h4 className="text-sm font-semibold text-neutral-300 mb-3">
          Bewegungen
        </h4>
        {movements.length === 0 ? (
          <div className="py-8 text-center text-neutral-500">
            <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Keine Materialbewegungen vorhanden</p>
          </div>
        ) : (
          <div className="space-y-1">
            {movements.map((m) => {
              const isOutgoing = m.direction === "outgoing";
              return (
                <div
                  key={m.id}
                  className="flex items-start gap-3 py-2 border-b border-neutral-800/50 last:border-0"
                >
                  {isOutgoing ? (
                    <ArrowUpRight className="w-4 h-4 mt-0.5 shrink-0 text-red-400" />
                  ) : (
                    <ArrowDownLeft className="w-4 h-4 mt-0.5 shrink-0 text-green-400" />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-white">
                      {m.quantity}
                      {m.product?.unit ? ` ${m.product.unit}` : "x"}{" "}
                      {m.product?.name ?? m.product_id}
                    </span>
                    {m.subcontractor && (
                      <span className="text-neutral-400 text-sm">
                        {isOutgoing ? " → " : " ← "}
                        {m.subcontractor.company_name}
                      </span>
                    )}
                    <span className="ml-2 text-xs text-neutral-500">
                      ({isOutgoing ? "Ausgabe" : "Rückgabe"})
                    </span>
                    {m.notes && (
                      <p className="text-xs text-neutral-500 mt-0.5 truncate">
                        {m.notes}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-neutral-500 shrink-0">
                    {formatMovementDate(m.date)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Outgoing Modal */}
      <Modal
        open={showOutgoing}
        onClose={() => setShowOutgoing(false)}
        title="Materialausgabe"
        size="md"
      >
        <form onSubmit={handleOutgoingSubmit} className="space-y-4">
          {/* Product search */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">
              Produkt *
            </label>
            {selectedProduct ? (
              <div className="flex items-center justify-between p-2 bg-neutral-800 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-white">
                    {selectedProduct.name}
                  </p>
                  <p className="text-xs text-neutral-400">
                    {selectedProduct.sku} · {selectedProduct.unit} ·{" "}
                    {currencyFmt.format(selectedProduct.purchase_list_price)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProduct(null);
                    setProductSearch("");
                    setProductResults([]);
                  }}
                  className="text-xs text-neutral-400 hover:text-white px-2 py-1"
                >
                  Ändern
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="flex items-center gap-2 p-2 bg-neutral-800 border border-neutral-700 rounded-lg">
                  <Search className="w-4 h-4 text-neutral-500 shrink-0" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Produkt suchen..."
                    className="flex-1 bg-transparent text-sm text-white placeholder-neutral-500 outline-none"
                    autoFocus
                  />
                  {searchLoading && <Spinner className="w-4 h-4" />}
                </div>
                {productResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-neutral-800 border border-neutral-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {productResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedProduct(p);
                          setProductSearch(p.name);
                          setProductResults([]);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-neutral-700 transition-colors"
                      >
                        <p className="text-sm text-white">{p.name}</p>
                        <p className="text-xs text-neutral-400">
                          {p.sku} · Bestand: {p.stock_quantity} {p.unit} ·{" "}
                          {currencyFmt.format(p.purchase_list_price)}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">
              Menge *{selectedProduct ? ` (${selectedProduct.unit})` : ""}
            </label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={outForm.quantity}
              onChange={(e) =>
                setOutForm((f) => ({ ...f, quantity: e.target.value }))
              }
              className="input w-full"
              required
            />
          </div>

          {/* Subcontractor */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">
              Nachunternehmer
            </label>
            <select
              value={outForm.subcontractor_id}
              onChange={(e) =>
                setOutForm((f) => ({ ...f, subcontractor_id: e.target.value }))
              }
              className="select w-full"
            >
              <option value="">— kein Nachunternehmer —</option>
              {subcontractors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.company_name}
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">
              Datum
            </label>
            <input
              type="date"
              value={outForm.date}
              onChange={(e) =>
                setOutForm((f) => ({ ...f, date: e.target.value }))
              }
              className="input w-full"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">
              Notiz
            </label>
            <textarea
              value={outForm.notes}
              onChange={(e) =>
                setOutForm((f) => ({ ...f, notes: e.target.value }))
              }
              className="textarea w-full"
              rows={2}
              placeholder="Optional..."
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={() => setShowOutgoing(false)}
              className="btn btn-ghost btn-sm"
              disabled={submitting}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={submitting || !selectedProduct}
            >
              {submitting ? <Spinner className="w-4 h-4" /> : "Speichern"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Returning Modal */}
      <Modal
        open={showReturning}
        onClose={() => setShowReturning(false)}
        title="Materialrückgabe"
        size="md"
      >
        <form onSubmit={handleReturningSubmit} className="space-y-4">
          {/* Product dropdown - only products with net_consumption > 0 */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">
              Produkt *
            </label>
            {returnableProducts.length === 0 ? (
              <p className="text-sm text-neutral-500">
                Keine ausgegebenen Materialien vorhanden.
              </p>
            ) : (
              <select
                value={retForm.product_id}
                onChange={(e) =>
                  setRetForm((f) => ({ ...f, product_id: e.target.value, quantity: "" }))
                }
                className="select w-full"
                required
              >
                <option value="">— Produkt wählen —</option>
                {returnableProducts.map((s) => (
                  <option key={s.product_id} value={s.product_id}>
                    {s.product_name} (max. {s.net_consumption} {s.unit})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">
              Menge *
              {retForm.product_id && (() => {
                const row = summary.find((s) => s.product_id === retForm.product_id);
                return row ? ` (max. ${row.net_consumption} ${row.unit})` : "";
              })()}
            </label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              max={
                retForm.product_id
                  ? summary.find((s) => s.product_id === retForm.product_id)
                      ?.net_consumption ?? undefined
                  : undefined
              }
              value={retForm.quantity}
              onChange={(e) =>
                setRetForm((f) => ({ ...f, quantity: e.target.value }))
              }
              className="input w-full"
              required
            />
          </div>

          {/* Subcontractor */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">
              Nachunternehmer
            </label>
            <select
              value={retForm.subcontractor_id}
              onChange={(e) =>
                setRetForm((f) => ({ ...f, subcontractor_id: e.target.value }))
              }
              className="select w-full"
            >
              <option value="">— kein Nachunternehmer —</option>
              {subcontractors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.company_name}
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">
              Datum
            </label>
            <input
              type="date"
              value={retForm.date}
              onChange={(e) =>
                setRetForm((f) => ({ ...f, date: e.target.value }))
              }
              className="input w-full"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-1">
              Notiz
            </label>
            <textarea
              value={retForm.notes}
              onChange={(e) =>
                setRetForm((f) => ({ ...f, notes: e.target.value }))
              }
              className="textarea w-full"
              rows={2}
              placeholder="Optional..."
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={() => setShowReturning(false)}
              className="btn btn-ghost btn-sm"
              disabled={submitting}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={submitting || !retForm.product_id}
            >
              {submitting ? <Spinner className="w-4 h-4" /> : "Speichern"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
