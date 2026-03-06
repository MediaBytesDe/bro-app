"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProfitTrendItem {
  period: string;
  revenue: number;
  costs: number;
  overhead: number;
  profit: number;
}

interface CostDistributionItem {
  type: string;
  value: number;
}

interface ProjectMarginItem {
  project_name: string;
  quote_total: number;
  total_costs: number;
  profit: number;
  margin_percent: number;
}

interface SubPerformanceItem {
  subcontractor_name: string;
  trade: string;
  total_invoiced: number;
  project_count: number;
}

interface TradePerformanceItem {
  trade: string;
  total_costs: number;
  project_count: number;
  avg_margin: number;
}

interface StatisticsData {
  profitTrend: ProfitTrendItem[];
  costDistribution: CostDistributionItem[];
  projectMargins: ProjectMarginItem[];
  subPerformance: SubPerformanceItem[];
  tradePerformance: TradePerformanceItem[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOOLTIP_STYLE = {
  contentStyle: {
    background: "#1a1a1a",
    border: "1px solid #333",
    borderRadius: 8,
    fontSize: 12,
  },
  labelStyle: { color: "#fff" },
};

const AXIS_TICK = { fontSize: 11, fill: "#666" };

const COST_COLORS: Record<string, string> = {
  "Sub-Rechnungen": "#3b82f6",
  Material: "#f59e0b",
  Gemeinkosten: "#8b5cf6",
  Sonstige: "#6b7280",
};

const PERIODS = ["Woche", "Monat", "Quartal", "Jahr"] as const;
type PeriodLabel = (typeof PERIODS)[number];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

type TableTab = "top_flop" | "sub" | "gewerke";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(v);

const formatPercent = (v: number) =>
  `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;

async function callApi(action: string, extra?: Record<string, unknown>) {
  const res = await fetch("/api/statistics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...extra }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.data;
}

// ---------------------------------------------------------------------------
// Custom PieChart label (hidden — we use legend instead)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StatisticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<StatisticsData | null>(null);
  const [selectedPeriod] = useState<PeriodLabel>("Monat");
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [activeTab, setActiveTab] = useState<TableTab>("top_flop");

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear]);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [profitTrend, costDistribution, projectMargins, subPerformance, tradePerformance] =
        await Promise.all([
          callApi("profit_trend", { period: "month", count: 12 }),
          callApi("cost_distribution", { year: selectedYear }),
          callApi("project_margins", { limit: 20 }),
          callApi("sub_performance"),
          callApi("trade_performance"),
        ]);

      setStats({
        profitTrend: profitTrend as ProfitTrendItem[],
        costDistribution: costDistribution as CostDistributionItem[],
        projectMargins: projectMargins as ProjectMarginItem[],
        subPerformance: subPerformance as SubPerformanceItem[],
        tradePerformance: tradePerformance as TradePerformanceItem[],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler beim Laden");
    }
    setLoading(false);
  }

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl font-bold text-white">Statistiken</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-500">Zeitraum:</span>
          <div className="flex gap-1">
            {PERIODS.map((p) => (
              <button
                key={p}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  selectedPeriod === p
                    ? "bg-[#fa432a] text-white"
                    : "bg-[#1a1a1a] text-neutral-400 hover:text-white border border-[#262626]"
                }`}
                disabled
              >
                {p}
              </button>
            ))}
          </div>
          <span className="text-xs text-neutral-500 ml-2">Jahr:</span>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-[#1a1a1a] border border-[#262626] text-white text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-[#fa432a]"
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="card p-4 border-red-500/30 text-red-400 text-sm">{error}</div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card p-4 h-64 animate-pulse bg-[#111]" />
          ))}
        </div>
      )}

      {/* Charts */}
      {!loading && stats && (
        <>
          <div className="grid md:grid-cols-2 gap-4">
            {/* Gewinn-Trend */}
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Gewinn-Trend</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={stats.profitTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                  <XAxis
                    dataKey="period"
                    tick={AXIS_TICK}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={AXIS_TICK}
                    axisLine={false}
                    tickLine={false}
                    width={55}
                    tickFormatter={(v: number) =>
                      v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                    }
                  />
                  <Tooltip
                    {...TOOLTIP_STYLE}
                    // @ts-expect-error recharts v3 formatter type mismatch
                    formatter={(value: number, name: string) => [
                      formatCurrency(value ?? 0),
                      name === "revenue" ? "Umsatz" : "Gewinn",
                    ]}
                  />
                  <Legend
                    formatter={(value: string) =>
                      value === "revenue" ? "Umsatz" : "Gewinn"
                    }
                    wrapperStyle={{ fontSize: 11, color: "#999" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="profit"
                    stroke="#fa432a"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Kostenverteilung */}
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-white mb-3">
                Kostenverteilung {selectedYear}
              </h3>
              {stats.costDistribution.length === 0 ? (
                <div className="flex items-center justify-center h-44 text-neutral-600 text-sm">
                  Keine Daten
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={140} height={140}>
                    <PieChart>
                      <Pie
                        data={stats.costDistribution}
                        dataKey="value"
                        nameKey="type"
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={65}
                        paddingAngle={2}
                      >
                        {stats.costDistribution.map((entry) => (
                          <Cell
                            key={entry.type}
                            fill={COST_COLORS[entry.type] ?? "#6b7280"}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        {...TOOLTIP_STYLE}
                        formatter={(value: number | undefined) => [formatCurrency(value ?? 0), ""]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2">
                    {stats.costDistribution.map((entry) => {
                      const total = stats.costDistribution.reduce(
                        (s, e) => s + e.value,
                        0
                      );
                      const pct = total > 0 ? ((entry.value / total) * 100).toFixed(0) : "0";
                      return (
                        <div key={entry.type} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <div
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: COST_COLORS[entry.type] ?? "#6b7280" }}
                            />
                            <span className="text-neutral-400">{entry.type}</span>
                          </div>
                          <span className="font-medium text-white">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Marge pro Projekt (horizontal bar) */}
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Marge pro Projekt</h3>
              {stats.projectMargins.length === 0 ? (
                <div className="flex items-center justify-center h-44 text-neutral-600 text-sm">
                  Keine Daten
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(180, stats.projectMargins.slice(0, 10).length * 28)}>
                  <BarChart
                    layout="vertical"
                    data={stats.projectMargins.slice(0, 10)}
                    margin={{ left: 0, right: 16 }}
                  >
                    <XAxis
                      type="number"
                      tick={AXIS_TICK}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => `${v}%`}
                    />
                    <YAxis
                      type="category"
                      dataKey="project_name"
                      tick={AXIS_TICK}
                      axisLine={false}
                      tickLine={false}
                      width={110}
                      tickFormatter={(v: string) =>
                        v.length > 14 ? `${v.slice(0, 14)}…` : v
                      }
                    />
                    <Tooltip
                      {...TOOLTIP_STYLE}
                      formatter={(value: number | undefined) => [`${(value ?? 0).toFixed(1)}%`, "Marge"]}
                    />
                    <Bar dataKey="margin_percent" radius={[0, 4, 4, 0]}>
                      {stats.projectMargins.slice(0, 10).map((entry, index) => (
                        <Cell
                          key={index}
                          fill={entry.margin_percent >= 0 ? "#22c55e" : "#ef4444"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Soll/Ist Vergleich */}
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Soll/Ist Vergleich</h3>
              {stats.projectMargins.length === 0 ? (
                <div className="flex items-center justify-center h-44 text-neutral-600 text-sm">
                  Keine Daten
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stats.projectMargins.slice(0, 8)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                    <XAxis
                      dataKey="project_name"
                      tick={AXIS_TICK}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: string) =>
                        v.length > 8 ? `${v.slice(0, 8)}…` : v
                      }
                    />
                    <YAxis
                      tick={AXIS_TICK}
                      axisLine={false}
                      tickLine={false}
                      width={55}
                      tickFormatter={(v: number) =>
                        v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                      }
                    />
                    <Tooltip
                      {...TOOLTIP_STYLE}
                      // @ts-expect-error recharts v3 formatter type mismatch
                      formatter={(value: number, name: string) => [
                        formatCurrency(value ?? 0),
                        name === "quote_total" ? "Soll" : "Ist",
                      ]}
                    />
                    <Legend
                      formatter={(value: string) =>
                        value === "quote_total" ? "Soll" : "Ist"
                      }
                      wrapperStyle={{ fontSize: 11, color: "#999" }}
                    />
                    <Bar dataKey="quote_total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="total_costs" fill="#fa432a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Tables */}
          <div className="card p-4">
            {/* Tab switcher */}
            <div className="flex gap-1 mb-4">
              {(
                [
                  { key: "top_flop" as TableTab, label: "Top/Flop Projekte" },
                  { key: "sub" as TableTab, label: "Sub-Performance" },
                  { key: "gewerke" as TableTab, label: "Gewerke" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeTab === tab.key
                      ? "bg-[#fa432a] text-white"
                      : "bg-[#1a1a1a] text-neutral-400 hover:text-white border border-[#262626]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Top/Flop Projekte */}
            {activeTab === "top_flop" && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#1a1a1a]">
                      <th className="text-left py-2 px-2 text-neutral-500 font-medium">Projekt</th>
                      <th className="text-right py-2 px-2 text-neutral-500 font-medium">Angebot</th>
                      <th className="text-right py-2 px-2 text-neutral-500 font-medium">Kosten</th>
                      <th className="text-right py-2 px-2 text-neutral-500 font-medium">Gewinn</th>
                      <th className="text-right py-2 px-2 text-neutral-500 font-medium">Marge</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.projectMargins.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-neutral-600">
                          Keine Daten
                        </td>
                      </tr>
                    )}
                    {stats.projectMargins.map((row, i) => (
                      <tr
                        key={i}
                        className="border-b border-[#111] hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="py-2 px-2 text-white font-medium">{row.project_name}</td>
                        <td className="py-2 px-2 text-right text-neutral-300">
                          {formatCurrency(row.quote_total)}
                        </td>
                        <td className="py-2 px-2 text-right text-neutral-300">
                          {formatCurrency(row.total_costs)}
                        </td>
                        <td
                          className={`py-2 px-2 text-right font-medium ${
                            row.profit >= 0 ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          {formatCurrency(row.profit)}
                        </td>
                        <td
                          className={`py-2 px-2 text-right font-semibold ${
                            row.margin_percent >= 10
                              ? "text-green-400"
                              : row.margin_percent >= 0
                              ? "text-yellow-400"
                              : "text-red-400"
                          }`}
                        >
                          {formatPercent(row.margin_percent)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Sub-Performance */}
            {activeTab === "sub" && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#1a1a1a]">
                      <th className="text-left py-2 px-2 text-neutral-500 font-medium">Subunternehmer</th>
                      <th className="text-left py-2 px-2 text-neutral-500 font-medium">Gewerk</th>
                      <th className="text-right py-2 px-2 text-neutral-500 font-medium">Gesamt-Rechnungen</th>
                      <th className="text-right py-2 px-2 text-neutral-500 font-medium">Projekte</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.subPerformance.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center py-8 text-neutral-600">
                          Keine Daten
                        </td>
                      </tr>
                    )}
                    {stats.subPerformance.map((row, i) => (
                      <tr
                        key={i}
                        className="border-b border-[#111] hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="py-2 px-2 text-white font-medium">
                          {row.subcontractor_name}
                        </td>
                        <td className="py-2 px-2 text-neutral-400">{row.trade}</td>
                        <td className="py-2 px-2 text-right text-neutral-300">
                          {formatCurrency(row.total_invoiced)}
                        </td>
                        <td className="py-2 px-2 text-right text-neutral-400">
                          {row.project_count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Gewerke */}
            {activeTab === "gewerke" && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#1a1a1a]">
                      <th className="text-left py-2 px-2 text-neutral-500 font-medium">Gewerk</th>
                      <th className="text-right py-2 px-2 text-neutral-500 font-medium">Gesamtkosten</th>
                      <th className="text-right py-2 px-2 text-neutral-500 font-medium">Projekte</th>
                      <th className="text-right py-2 px-2 text-neutral-500 font-medium">Ø Marge</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.tradePerformance.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center py-8 text-neutral-600">
                          Keine Daten
                        </td>
                      </tr>
                    )}
                    {stats.tradePerformance.map((row, i) => (
                      <tr
                        key={i}
                        className="border-b border-[#111] hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="py-2 px-2 text-white font-medium">{row.trade}</td>
                        <td className="py-2 px-2 text-right text-neutral-300">
                          {formatCurrency(row.total_costs)}
                        </td>
                        <td className="py-2 px-2 text-right text-neutral-400">
                          {row.project_count}
                        </td>
                        <td
                          className={`py-2 px-2 text-right font-semibold ${
                            row.avg_margin >= 10
                              ? "text-green-400"
                              : row.avg_margin >= 0
                              ? "text-yellow-400"
                              : "text-red-400"
                          }`}
                        >
                          {formatPercent(row.avg_margin)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
