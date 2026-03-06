"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TrendingUp, Percent, Calculator, AlertTriangle, CheckCircle } from "lucide-react";
import type { OverheadSettings } from "@/types/nachkalkulation";

interface ProfitKPIData {
  monthlyRevenue: number;
  monthlyCostsTotal: number;
  monthlyProfit: number;
  avgMargin: number;
  openCalcCount: number;
  lowStockCount: number;
}

export function ProfitKPISection() {
  const [data, setData] = useState<ProfitKPIData | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split("T")[0];

      const [costsRes, openCalcRes, overheadRes, lowStockRes] = await Promise.all([
        supabase
          .from("project_costs")
          .select("project_id, amount")
          .gte("date", startOfMonth),
        supabase
          .from("project_calculation_status")
          .select("id", { count: "exact", head: true })
          .neq("status", "closed"),
        fetch("/api/overhead", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "get" }),
        }),
        fetch("/api/material", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "low_stock" }),
        }),
      ]);

      const monthlyCostRows = costsRes.data || [];
      const openCalcCount = openCalcRes.count || 0;

      const overheadJson = await overheadRes.json();
      const overhead = overheadJson.data as OverheadSettings | null;

      const lowStockJson = await lowStockRes.json();
      const lowStockProducts: unknown[] = lowStockJson.data || [];

      // Fetch accepted quotes for projects that have costs this month
      const projectIds = [...new Set(monthlyCostRows.map((c) => c.project_id))];

      let monthlyRevenue = 0;
      if (projectIds.length > 0) {
        const { data: quotes } = await supabase
          .from("wawi_quotes")
          .select("project_id, total_amount")
          .eq("status", "accepted")
          .in("project_id", projectIds);

        monthlyRevenue = (quotes || []).reduce(
          (sum, q) => sum + (q.total_amount || 0),
          0
        );
      }

      const monthlyCostsTotal = monthlyCostRows.reduce(
        (sum, c) => sum + (c.amount || 0),
        0
      );
      const overheadAmount =
        (monthlyCostsTotal * (overhead?.overhead_percentage || 0)) / 100;
      const monthlyProfit = monthlyRevenue - monthlyCostsTotal - overheadAmount;
      const avgMargin =
        monthlyRevenue > 0 ? (monthlyProfit / monthlyRevenue) * 100 : 0;

      setData({
        monthlyRevenue,
        monthlyCostsTotal,
        monthlyProfit,
        avgMargin,
        openCalcCount,
        lowStockCount: lowStockProducts.length,
      });
    } catch (e) {
      console.error("ProfitKPI load error:", e);
    }
    setLoading(false);
  }

  if (loading || !data) return null;

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(v);

  const isPositiveProfit = data.monthlyProfit >= 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {/* Card 1: Gewinn Monat */}
      <div className="card p-3">
        <div className="text-xs text-neutral-500 flex items-center gap-1 mb-1">
          <TrendingUp
            className={`w-3 h-3 ${isPositiveProfit ? "text-green-400" : "text-red-400"}`}
          />
          Gewinn Monat
        </div>
        <div
          className={`text-xl font-bold ${isPositiveProfit ? "text-green-400" : "text-red-400"}`}
        >
          {formatCurrency(data.monthlyProfit)}
        </div>
      </div>

      {/* Card 2: Ø Marge */}
      <div className="card p-3">
        <div className="text-xs text-neutral-500 flex items-center gap-1 mb-1">
          <Percent className="w-3 h-3" />
          Marge
        </div>
        <div className="text-xl font-bold text-white">
          {data.avgMargin.toLocaleString("de-DE", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          })}
          %
        </div>
      </div>

      {/* Card 3: Offene Kalkulationen */}
      <div className="card p-3">
        <div className="text-xs text-neutral-500 flex items-center gap-1 mb-1">
          <Calculator className="w-3 h-3" />
          Offene Kalk.
        </div>
        <div className="text-xl font-bold text-white">
          {data.openCalcCount}{" "}
          <span className="text-sm font-normal text-neutral-500">
            {data.openCalcCount === 1 ? "Projekt" : "Projekte"}
          </span>
        </div>
      </div>

      {/* Card 4: Lager-Warnungen */}
      <div className="card p-3">
        <div className="text-xs text-neutral-500 flex items-center gap-1 mb-1">
          <AlertTriangle
            className={`w-3 h-3 ${data.lowStockCount > 0 ? "text-yellow-400" : "text-green-400"}`}
          />
          Lager
        </div>
        {data.lowStockCount > 0 ? (
          <div className="text-xl font-bold text-yellow-400">
            {data.lowStockCount}{" "}
            <span className="text-sm font-normal text-neutral-500">
              {data.lowStockCount === 1 ? "Artikel" : "Artikel"}
            </span>
          </div>
        ) : (
          <div className="text-xl font-bold text-green-400 flex items-center gap-1">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Alles OK</span>
          </div>
        )}
      </div>
    </div>
  );
}
