import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const body = await req.json();
  const { action, ...data } = body;

  try {
    switch (action) {
      // ------------------------------------------------------------------
      case "profit_trend": {
        const { period = "month", count = 12 } = data as {
          period?: "week" | "month" | "quarter" | "year";
          count?: number;
        };

        if (period === "month") {
          const now = new Date();
          const months: { year: number; month: number; label: string }[] = [];

          for (let i = count - 1; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const year = d.getFullYear();
            const month = d.getMonth() + 1;
            const label = d.toLocaleDateString("de-DE", {
              month: "short",
              year: "2-digit",
            });
            months.push({ year, month, label });
          }

          // Fetch all project_costs
          const { data: costsRaw, error: costsError } = await admin
            .from("project_costs")
            .select("amount, date, cost_type");

          if (costsError) {
            return NextResponse.json({ error: costsError.message }, { status: 500 });
          }

          // Fetch accepted quotes with project_id
          const { data: quotesRaw, error: quotesError } = await admin
            .from("wawi_quotes")
            .select("id, total_amount, quote_date, project_id")
            .eq("status", "accepted");

          if (quotesError) {
            return NextResponse.json({ error: quotesError.message }, { status: 500 });
          }

          // Build result per month
          const result = months.map(({ year, month, label }) => {
            const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
            const endDateObj = new Date(year, month, 0);
            const endDate = `${year}-${String(month).padStart(2, "0")}-${String(endDateObj.getDate()).padStart(2, "0")}`;

            const costs = (costsRaw ?? [])
              .filter((c) => c.date >= startDate && c.date <= endDate)
              .reduce((sum, c) => sum + (c.amount ?? 0), 0);

            const revenue = (quotesRaw ?? [])
              .filter((q) => q.quote_date >= startDate && q.quote_date <= endDate)
              .reduce((sum, q) => sum + (q.total_amount ?? 0), 0);

            // Overhead: simplified flat 15% of costs
            const overhead = costs * 0.15;
            const profit = revenue - costs - overhead;

            return {
              period: label,
              revenue: Math.round(revenue),
              costs: Math.round(costs),
              overhead: Math.round(overhead),
              profit: Math.round(profit),
            };
          });

          return NextResponse.json({ data: result });
        }

        // Fallback for other periods: return empty
        return NextResponse.json({ data: [] });
      }

      // ------------------------------------------------------------------
      case "cost_distribution": {
        const { year = new Date().getFullYear() } = data as { year?: number };

        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;

        // Get project_costs grouped by cost_type
        const { data: costsRaw, error: costsError } = await admin
          .from("project_costs")
          .select("cost_type, amount, date")
          .gte("date", startDate)
          .lte("date", endDate);

        if (costsError) {
          return NextResponse.json({ error: costsError.message }, { status: 500 });
        }

        // Get overhead_settings for the year
        const { data: overheadRows } = await admin
          .from("overhead_settings")
          .select("planned_overhead_costs")
          .eq("year", year)
          .limit(1);

        const overheadAmount =
          overheadRows && overheadRows.length > 0
            ? (overheadRows[0].planned_overhead_costs as number)
            : 0;

        // Get material_movements (outgoing - returning)
        const { data: movementsRaw, error: movementsError } = await admin
          .from("material_movements")
          .select("direction, quantity, unit_price, date")
          .gte("date", startDate)
          .lte("date", endDate);

        if (movementsError) {
          return NextResponse.json({ error: movementsError.message }, { status: 500 });
        }

        const typeMap = new Map<string, number>();

        for (const cost of costsRaw ?? []) {
          const type = cost.cost_type as string;
          const label =
            type === "subcontractor_invoice"
              ? "Sub-Rechnungen"
              : type === "material"
              ? "Material"
              : type === "overhead"
              ? "Gemeinkosten"
              : "Sonstige";
          typeMap.set(label, (typeMap.get(label) ?? 0) + (cost.amount ?? 0));
        }

        // Add material movements
        const materialTotal = (movementsRaw ?? []).reduce((sum, m) => {
          const amount = (m.quantity ?? 0) * (m.unit_price ?? 0);
          return m.direction === "outgoing" ? sum + amount : sum - amount;
        }, 0);

        if (materialTotal > 0) {
          typeMap.set("Material", (typeMap.get("Material") ?? 0) + materialTotal);
        }

        if (overheadAmount > 0) {
          typeMap.set("Gemeinkosten", (typeMap.get("Gemeinkosten") ?? 0) + overheadAmount);
        }

        const result = Array.from(typeMap.entries()).map(([type, value]) => ({
          type,
          value: Math.round(value),
        }));

        return NextResponse.json({ data: result });
      }

      // ------------------------------------------------------------------
      case "project_margins": {
        const { limit = 20 } = data as { limit?: number };

        // Get all projects that have project_costs
        const { data: costsRaw, error: costsError } = await admin
          .from("project_costs")
          .select("project_id, amount");

        if (costsError) {
          return NextResponse.json({ error: costsError.message }, { status: 500 });
        }

        // Get accepted quotes per project
        const { data: quotesRaw, error: quotesError } = await admin
          .from("wawi_quotes")
          .select("project_id, total_amount, customer:customers(company_name, first_name, last_name)")
          .eq("status", "accepted");

        if (quotesError) {
          return NextResponse.json({ error: quotesError.message }, { status: 500 });
        }

        // Aggregate costs per project
        const costsByProject = new Map<string, number>();
        for (const c of costsRaw ?? []) {
          const pid = c.project_id as string;
          costsByProject.set(pid, (costsByProject.get(pid) ?? 0) + (c.amount ?? 0));
        }

        // Aggregate revenue per project
        type QuoteRow = {
          project_id: string;
          total_amount: number;
          customer: { company_name?: string; first_name?: string; last_name?: string } | null;
        };

        const revenueByProject = new Map<string, { revenue: number; name: string }>();
        for (const q of (quotesRaw as unknown as QuoteRow[]) ?? []) {
          const pid = q.project_id;
          if (!pid) continue;
          const existing = revenueByProject.get(pid);
          const customerName = q.customer?.company_name
            ?? `${q.customer?.first_name ?? ""} ${q.customer?.last_name ?? ""}`.trim()
            ?? "Unbekannt";

          revenueByProject.set(pid, {
            revenue: (existing?.revenue ?? 0) + (q.total_amount ?? 0),
            name: existing?.name ?? customerName,
          });
        }

        // Build margin results
        const marginResults: {
          project_name: string;
          quote_total: number;
          total_costs: number;
          profit: number;
          margin_percent: number;
        }[] = [];

        for (const [pid, { revenue, name }] of revenueByProject.entries()) {
          const totalCosts = costsByProject.get(pid) ?? 0;
          const profit = revenue - totalCosts;
          const marginPercent = revenue > 0 ? (profit / revenue) * 100 : 0;

          marginResults.push({
            project_name: name,
            quote_total: Math.round(revenue),
            total_costs: Math.round(totalCosts),
            profit: Math.round(profit),
            margin_percent: Math.round(marginPercent * 10) / 10,
          });
        }

        // Sort by margin desc
        marginResults.sort((a, b) => b.margin_percent - a.margin_percent);

        return NextResponse.json({ data: marginResults.slice(0, limit) });
      }

      // ------------------------------------------------------------------
      case "sub_performance": {
        const { data: costsRaw, error: costsError } = await admin
          .from("project_costs")
          .select(
            "subcontractor_id, amount, project_id, subcontractor:subcontractors(company_name, trade)"
          )
          .eq("cost_type", "subcontractor_invoice");

        if (costsError) {
          return NextResponse.json({ error: costsError.message }, { status: 500 });
        }

        type SubCostRow = {
          subcontractor_id: string | null;
          amount: number;
          project_id: string;
          subcontractor: { company_name: string; trade?: string } | null;
        };

        const subMap = new Map<
          string,
          { name: string; trade: string; total: number; projects: Set<string> }
        >();

        for (const c of (costsRaw as unknown as SubCostRow[]) ?? []) {
          if (!c.subcontractor_id) continue;
          const existing = subMap.get(c.subcontractor_id);
          if (existing) {
            existing.total += c.amount ?? 0;
            existing.projects.add(c.project_id);
          } else {
            subMap.set(c.subcontractor_id, {
              name: c.subcontractor?.company_name ?? "Unbekannt",
              trade: c.subcontractor?.trade ?? "-",
              total: c.amount ?? 0,
              projects: new Set([c.project_id]),
            });
          }
        }

        const result = Array.from(subMap.values()).map((s) => ({
          subcontractor_name: s.name,
          trade: s.trade,
          total_invoiced: Math.round(s.total),
          project_count: s.projects.size,
        }));

        result.sort((a, b) => b.total_invoiced - a.total_invoiced);

        return NextResponse.json({ data: result });
      }

      // ------------------------------------------------------------------
      case "trade_performance": {
        const { data: costsRaw, error: costsError } = await admin
          .from("project_costs")
          .select(
            "amount, project_id, subcontractor:subcontractors(trade)"
          )
          .eq("cost_type", "subcontractor_invoice");

        if (costsError) {
          return NextResponse.json({ error: costsError.message }, { status: 500 });
        }

        // Get accepted quotes per project for margin calculation
        const { data: quotesRaw, error: quotesError } = await admin
          .from("wawi_quotes")
          .select("project_id, total_amount")
          .eq("status", "accepted");

        if (quotesError) {
          return NextResponse.json({ error: quotesError.message }, { status: 500 });
        }

        type TradeCostRow = {
          amount: number;
          project_id: string;
          subcontractor: { trade?: string } | null;
        };

        const revenueByProject = new Map<string, number>();
        for (const q of quotesRaw ?? []) {
          const pid = q.project_id as string;
          if (!pid) continue;
          revenueByProject.set(pid, (revenueByProject.get(pid) ?? 0) + (q.total_amount ?? 0));
        }

        const tradeMap = new Map<
          string,
          { total: number; projects: Set<string> }
        >();

        for (const c of (costsRaw as unknown as TradeCostRow[]) ?? []) {
          const trade = c.subcontractor?.trade ?? "Sonstige";
          const existing = tradeMap.get(trade);
          if (existing) {
            existing.total += c.amount ?? 0;
            existing.projects.add(c.project_id);
          } else {
            tradeMap.set(trade, {
              total: c.amount ?? 0,
              projects: new Set([c.project_id]),
            });
          }
        }

        const result = Array.from(tradeMap.entries()).map(([trade, val]) => {
          // Calculate avg margin across projects in this trade
          let totalRevenue = 0;
          for (const pid of val.projects) {
            totalRevenue += revenueByProject.get(pid) ?? 0;
          }
          const profit = totalRevenue - val.total;
          const avgMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

          return {
            trade,
            total_costs: Math.round(val.total),
            project_count: val.projects.size,
            avg_margin: Math.round(avgMargin * 10) / 10,
          };
        });

        result.sort((a, b) => b.total_costs - a.total_costs);

        return NextResponse.json({ data: result });
      }

      // ------------------------------------------------------------------
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err: unknown) {
    console.error("[Statistics API] Error:", err);
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
