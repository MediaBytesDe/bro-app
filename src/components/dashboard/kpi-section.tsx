"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";
import { TrendingUp, Users, FileSignature, Package } from "lucide-react";

interface KPIData {
  quotesByMonth: { month: string; count: number; value: number }[];
  leadsByStatus: { status: string; count: number }[];
  topCustomers: { name: string; value: number }[];
  conversionRate: number;
  avgDealSize: number;
  totalRevenue: number;
}

const STATUS_COLORS: Record<string, string> = {
  new: "#3b82f6",
  contacted: "#f59e0b",
  qualified: "#8b5cf6",
  proposal: "#f97316",
  negotiation: "#06b6d4",
  won: "#22c55e",
  lost: "#ef4444",
};

const STATUS_LABELS: Record<string, string> = {
  new: "Neu",
  contacted: "Kontaktiert",
  qualified: "Qualifiziert",
  proposal: "Angebot",
  negotiation: "Verhandlung",
  won: "Gewonnen",
  lost: "Verloren",
};

export function KPISection() {
  const [data, setData] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadKPIs();
  }, []);

  async function loadKPIs() {
    setLoading(true);
    try {
      const [quotesRes, leadsRes, wonLeadsRes] = await Promise.all([
        supabase.from("wawi_quotes").select("id, total_amount, quote_date, status, customer:customers(company_name, first_name, last_name)").order("quote_date", { ascending: false }).limit(200),
        supabase.from("leads").select("id, status, value"),
        supabase.from("leads").select("id, value").eq("status", "won"),
      ]);

      const quotes = quotesRes.data || [];
      const leads = leadsRes.data || [];
      const wonLeads = wonLeadsRes.data || [];

      // Quotes by month (last 6 months)
      const monthMap = new Map<string, { count: number; value: number }>();
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = d.toLocaleDateString("de-DE", { month: "short", year: "2-digit" });
        monthMap.set(key, { count: 0, value: 0 });
      }
      quotes.forEach((q) => {
        const d = new Date(q.quote_date);
        const key = d.toLocaleDateString("de-DE", { month: "short", year: "2-digit" });
        const entry = monthMap.get(key);
        if (entry) {
          entry.count++;
          entry.value += q.total_amount || 0;
        }
      });
      const quotesByMonth = Array.from(monthMap.entries()).map(([month, data]) => ({
        month,
        ...data,
      }));

      // Leads by status
      const statusMap = new Map<string, number>();
      leads.forEach((l) => {
        const s = l.status || "new";
        statusMap.set(s, (statusMap.get(s) || 0) + 1);
      });
      const leadsByStatus = Array.from(statusMap.entries()).map(([status, count]) => ({ status, count }));

      // Top customers by quote value
      const customerMap = new Map<string, number>();
      quotes.forEach((q) => {
        const name = q.customer
          ? ((q.customer as any).company_name || `${(q.customer as any).first_name || ""} ${(q.customer as any).last_name || ""}`.trim())
          : "Unbekannt";
        customerMap.set(name, (customerMap.get(name) || 0) + (q.total_amount || 0));
      });
      const topCustomers = Array.from(customerMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

      // Metrics
      const totalLeads = leads.length;
      const conversionRate = totalLeads > 0 ? (wonLeads.length / totalLeads) * 100 : 0;
      const avgDealSize = wonLeads.length > 0
        ? wonLeads.reduce((sum, l) => sum + (l.value || 0), 0) / wonLeads.length
        : 0;
      const totalRevenue = quotes
        .filter((q) => q.status === "accepted")
        .reduce((sum, q) => sum + (q.total_amount || 0), 0);

      setData({
        quotesByMonth,
        leadsByStatus,
        topCustomers,
        conversionRate,
        avgDealSize,
        totalRevenue,
      });
    } catch (e) {
      console.error("KPI load error:", e);
    }
    setLoading(false);
  }

  if (loading || !data) return null;

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-3">
          <div className="text-xs text-neutral-500 flex items-center gap-1 mb-1">
            <TrendingUp className="w-3 h-3" /> Conversion Rate
          </div>
          <div className="text-xl font-bold text-white">{data.conversionRate.toFixed(1)}%</div>
        </div>
        <div className="card p-3">
          <div className="text-xs text-neutral-500 mb-1">∅ Deal-Größe</div>
          <div className="text-xl font-bold text-green-400">{formatCurrency(data.avgDealSize)}</div>
        </div>
        <div className="card p-3">
          <div className="text-xs text-neutral-500 mb-1">Umsatz (akzeptiert)</div>
          <div className="text-xl font-bold text-green-400">{formatCurrency(data.totalRevenue)}</div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Quotes by Month Chart */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Angebote pro Monat</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.quotesByMonth}>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#666" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#666" }} axisLine={false} tickLine={false} width={30} />
              <Tooltip
                contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#fff" }}
                formatter={(value: number, name: string) => [
                  name === "value" ? formatCurrency(value) : value,
                  name === "value" ? "Wert" : "Anzahl"
                ]}
              />
              <Bar dataKey="count" fill="#fa432a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Lead Pipeline Pie */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Lead Pipeline</h3>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={120} height={120}>
              <PieChart>
                <Pie
                  data={data.leadsByStatus}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={55}
                  paddingAngle={2}
                >
                  {data.leadsByStatus.map((entry) => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || "#666"} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-1.5">
              {data.leadsByStatus.map((entry) => (
                <div key={entry.status} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: STATUS_COLORS[entry.status] || "#666" }}
                    />
                    <span className="text-neutral-400">{STATUS_LABELS[entry.status] || entry.status}</span>
                  </div>
                  <span className="font-medium text-white">{entry.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Top Customers */}
      {data.topCustomers.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Top Kunden (nach Angebotswert)</h3>
          <div className="space-y-2">
            {data.topCustomers.map((customer, i) => {
              const maxVal = data.topCustomers[0]?.value || 1;
              const pct = (customer.value / maxVal) * 100;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-neutral-600 w-4">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm text-white truncate">{customer.name}</span>
                      <span className="text-xs text-green-400 font-medium">{formatCurrency(customer.value)}</span>
                    </div>
                    <div className="h-1 bg-[#1f1f1f] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#fa432a] rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
