"use client";

import { useEffect, useState } from "react";
import { Settings, Calculator, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import type { OverheadSettings } from "@/types/nachkalkulation";

const CURRENT_YEAR = new Date().getFullYear();

function buildYearOptions(): number[] {
  const years: number[] = [];
  // next year
  years.push(CURRENT_YEAR + 1);
  // current year + 5 previous years
  for (let i = 0; i <= 5; i++) {
    years.push(CURRENT_YEAR - i);
  }
  return years;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function EinstellungenPage() {
  const yearOptions = buildYearOptions();

  const [selectedYear, setSelectedYear] = useState<number>(CURRENT_YEAR);
  const [plannedRevenue, setPlannedRevenue] = useState<string>("");
  const [plannedOverhead, setPlannedOverhead] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [loadingForm, setLoadingForm] = useState(false);
  const [history, setHistory] = useState<OverheadSettings[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const revenueNum = parseFloat(plannedRevenue.replace(/\./g, "").replace(",", ".")) || 0;
  const overheadNum = parseFloat(plannedOverhead.replace(/\./g, "").replace(",", ".")) || 0;
  const calculatedPercent =
    revenueNum > 0 ? (overheadNum / revenueNum) * 100 : 0;

  useEffect(() => {
    void loadHistory();
  }, []);

  useEffect(() => {
    void loadYearSettings(selectedYear);
  }, [selectedYear]);

  async function loadYearSettings(year: number) {
    setLoadingForm(true);
    try {
      const res = await fetch("/api/overhead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get", year }),
      });
      const json = (await res.json()) as { data: OverheadSettings | null; error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Fehler beim Laden");
        return;
      }
      if (json.data) {
        setPlannedRevenue(String(json.data.planned_revenue));
        setPlannedOverhead(String(json.data.planned_overhead_costs));
      } else {
        setPlannedRevenue("");
        setPlannedOverhead("");
      }
    } catch {
      toast.error("Netzwerkfehler beim Laden der Einstellungen");
    } finally {
      setLoadingForm(false);
    }
  }

  async function loadHistory() {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/overhead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list" }),
      });
      const json = (await res.json()) as { data: OverheadSettings[]; error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Fehler beim Laden der Historie");
        return;
      }
      setHistory(json.data ?? []);
    } catch {
      toast.error("Netzwerkfehler beim Laden der Historie");
    } finally {
      setLoadingHistory(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    if (revenueNum <= 0) {
      toast.error("Bitte einen geplanten Jahresumsatz eingeben");
      return;
    }
    if (overheadNum <= 0) {
      toast.error("Bitte geplante Gemeinkosten eingeben");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/overhead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsert",
          year: selectedYear,
          planned_revenue: revenueNum,
          planned_overhead_costs: overheadNum,
        }),
      });
      const json = (await res.json()) as { data: OverheadSettings; error?: string };
      if (!res.ok) {
        toast.error(json.error ?? "Fehler beim Speichern");
        return;
      }
      toast.success(`Einstellungen für ${selectedYear} gespeichert`);
      await loadHistory();
    } catch {
      toast.error("Netzwerkfehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Settings className="w-7 h-7 text-[#fa432a]" />
          Einstellungen
        </h1>
      </div>

      {/* Overhead Form Card */}
      <div className="card p-6 space-y-6">
        <div className="flex items-center gap-2 border-b border-neutral-800 pb-4">
          <Calculator className="w-5 h-5 text-[#fa432a]" />
          <h2 className="text-lg font-semibold text-white">Gemeinkosten-Kalkulation</h2>
        </div>

        {loadingForm ? (
          <div className="flex items-center justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-5">
            {/* Year */}
            <div>
              <label className="block text-sm text-neutral-400 mb-1.5">Jahr</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="input w-40"
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            {/* Planned Revenue */}
            <div>
              <label className="block text-sm text-neutral-400 mb-1.5">
                Geplanter Jahresumsatz
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={plannedRevenue}
                  onChange={(e) => setPlannedRevenue(e.target.value)}
                  placeholder="1500000"
                  className="input w-48"
                />
                <span className="text-neutral-400 text-sm">€</span>
              </div>
            </div>

            {/* Planned Overhead Costs */}
            <div>
              <label className="block text-sm text-neutral-400 mb-1.5">
                Geplante Gemeinkosten
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={plannedOverhead}
                  onChange={(e) => setPlannedOverhead(e.target.value)}
                  placeholder="180000"
                  className="input w-48"
                />
                <span className="text-neutral-400 text-sm">€</span>
              </div>
            </div>

            {/* Calculated percentage */}
            <div className="bg-neutral-900 rounded-lg px-4 py-3 flex items-center gap-3">
              <TrendingUp className="w-4 h-4 text-[#fa432a] shrink-0" />
              <div>
                <span className="text-sm text-neutral-400">Gemeinkostenzuschlag: </span>
                <span className="text-white font-semibold">
                  {formatPercent(calculatedPercent)} %
                </span>
                <span className="text-xs text-neutral-500 ml-2">(automatisch berechnet)</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="btn-primary flex items-center gap-2"
            >
              {saving ? <Spinner className="w-4 h-4" /> : null}
              Speichern
            </button>
          </form>
        )}
      </div>

      {/* History Card */}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-neutral-800">
          <TrendingUp className="w-5 h-5 text-[#fa432a]" />
          <h2 className="text-lg font-semibold text-white">Historie</h2>
        </div>

        {loadingHistory ? (
          <div className="flex items-center justify-center py-8">
            <Spinner />
          </div>
        ) : history.length === 0 ? (
          <div className="p-8 text-center text-neutral-500 text-sm">
            Noch keine Einstellungen gespeichert
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-neutral-500 uppercase tracking-wide border-b border-neutral-800 bg-[#0a0a0a]">
                  <th className="text-left py-3 px-4">Jahr</th>
                  <th className="text-right py-3 px-4">Umsatz (Plan)</th>
                  <th className="text-right py-3 px-4">Gemeinkosten</th>
                  <th className="text-right py-3 px-4">%</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-neutral-800/50 last:border-0 hover:bg-[#111] transition-colors"
                  >
                    <td className="py-3 px-4 text-white font-medium">{row.year}</td>
                    <td className="py-3 px-4 text-right text-neutral-300">
                      {formatCurrency(row.planned_revenue)} €
                    </td>
                    <td className="py-3 px-4 text-right text-neutral-300">
                      {formatCurrency(row.planned_overhead_costs)} €
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-[#fa432a] font-medium">
                        {formatPercent(row.overhead_percentage)} %
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
