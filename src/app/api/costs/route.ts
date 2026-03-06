import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  ProjectCost,
  PositionCostSummary,
  ProjectCostSummary,
  OpenItem,
} from "@/types/nachkalkulation";

const COSTS_JOIN =
  "*, subcontractor:subcontractors(company_name, trade), invoice:partner_invoices(invoice_number, file_url, amount)";

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
      case "list": {
        const { project_id } = data as { project_id: string };

        if (!project_id) {
          return NextResponse.json(
            { error: "project_id is required" },
            { status: 400 }
          );
        }

        const { data: costs, error } = await admin
          .from("project_costs")
          .select(COSTS_JOIN)
          .eq("project_id", project_id)
          .order("date", { ascending: false });

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data: costs as ProjectCost[] });
      }

      // ------------------------------------------------------------------
      case "create": {
        const {
          project_id,
          quote_id,
          quote_line_item_key,
          cost_type,
          description,
          amount,
          date,
          subcontractor_id,
          invoice_id,
          notes,
        } = data as {
          project_id: string;
          quote_id?: string;
          quote_line_item_key?: string;
          cost_type: string;
          description: string;
          amount: number;
          date: string;
          subcontractor_id?: string;
          invoice_id?: string;
          notes?: string;
        };

        if (!project_id || !cost_type || !description || amount == null || !date) {
          return NextResponse.json(
            {
              error:
                "project_id, cost_type, description, amount and date are required",
            },
            { status: 400 }
          );
        }

        const insertData: Record<string, unknown> = {
          project_id,
          cost_type,
          description,
          amount,
          date,
          created_by: user.id,
        };

        if (quote_id !== undefined) insertData.quote_id = quote_id;
        if (quote_line_item_key !== undefined)
          insertData.quote_line_item_key = quote_line_item_key;
        if (subcontractor_id !== undefined)
          insertData.subcontractor_id = subcontractor_id;
        if (invoice_id !== undefined) insertData.invoice_id = invoice_id;
        if (notes !== undefined) insertData.notes = notes;

        const { data: row, error } = await admin
          .from("project_costs")
          .insert(insertData)
          .select(COSTS_JOIN)
          .single();

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data: row as ProjectCost });
      }

      // ------------------------------------------------------------------
      case "update": {
        const { id, status, amount, notes, description } = data as {
          id: string;
          status?: string;
          amount?: number;
          notes?: string;
          description?: string;
        };

        if (!id) {
          return NextResponse.json(
            { error: "id is required" },
            { status: 400 }
          );
        }

        const updateData: Record<string, unknown> = {};
        if (status !== undefined) updateData.status = status;
        if (amount !== undefined) updateData.amount = amount;
        if (notes !== undefined) updateData.notes = notes;
        if (description !== undefined) updateData.description = description;

        if (Object.keys(updateData).length === 0) {
          return NextResponse.json(
            { error: "No fields to update" },
            { status: 400 }
          );
        }

        const { data: updated, error } = await admin
          .from("project_costs")
          .update(updateData)
          .eq("id", id)
          .select(COSTS_JOIN)
          .single();

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data: updated as ProjectCost });
      }

      // ------------------------------------------------------------------
      case "delete": {
        const { id } = data as { id: string };

        if (!id) {
          return NextResponse.json(
            { error: "id is required" },
            { status: 400 }
          );
        }

        const { error } = await admin
          .from("project_costs")
          .delete()
          .eq("id", id);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
      }

      // ------------------------------------------------------------------
      case "summary": {
        const { project_id } = data as { project_id: string };

        if (!project_id) {
          return NextResponse.json(
            { error: "project_id is required" },
            { status: 400 }
          );
        }

        // 1. Find the project's accepted quote
        const { data: quotes, error: quoteError } = await admin
          .from("wawi_quotes")
          .select("id, total_amount")
          .eq("project_id", project_id)
          .eq("status", "accepted")
          .limit(1);

        if (quoteError) {
          return NextResponse.json(
            { error: quoteError.message },
            { status: 500 }
          );
        }

        const quote = quotes && quotes.length > 0 ? quotes[0] : null;

        // 2. Get quote items if quote found
        type QuoteItem = {
          id: string;
          position_number: number;
          product_name: string;
          total_price: number;
        };

        let quoteItems: QuoteItem[] = [];

        if (quote) {
          const { data: items, error: itemsError } = await admin
            .from("wawi_quote_items")
            .select("id, position_number, product_name, total_price")
            .eq("quote_id", quote.id)
            .order("position_number", { ascending: true });

          if (itemsError) {
            return NextResponse.json(
              { error: itemsError.message },
              { status: 500 }
            );
          }

          quoteItems = (items ?? []) as QuoteItem[];
        }

        // 3. Get all project_costs for this project
        const { data: allCosts, error: costsError } = await admin
          .from("project_costs")
          .select(COSTS_JOIN)
          .eq("project_id", project_id);

        if (costsError) {
          return NextResponse.json(
            { error: costsError.message },
            { status: 500 }
          );
        }

        const projectCosts = (allCosts ?? []) as ProjectCost[];

        // 4. Get all material_movements for this project
        type MaterialMovement = {
          id: string;
          quote_line_item_key: string | null;
          direction: "outgoing" | "returning";
          quantity: number;
          unit_price: number;
          product?: { name: string; sku: string; unit: string; purchase_list_price: number };
        };

        const { data: movements, error: movementsError } = await admin
          .from("material_movements")
          .select(
            "id, quote_line_item_key, direction, quantity, unit_price, product:products(name, sku, unit, purchase_list_price)"
          )
          .eq("project_id", project_id);

        if (movementsError) {
          return NextResponse.json(
            { error: movementsError.message },
            { status: 500 }
          );
        }

        const materialMovements = (movements ?? []) as unknown as MaterialMovement[];

        // 5. Get current year overhead_settings
        const currentYear = new Date().getFullYear();
        const { data: overheadRows } = await admin
          .from("overhead_settings")
          .select("overhead_percentage")
          .eq("year", currentYear)
          .limit(1);

        const overheadPercentage =
          overheadRows && overheadRows.length > 0
            ? (overheadRows[0].overhead_percentage as number)
            : 0;

        // 6. Build PositionCostSummary for each quote item
        const positions: PositionCostSummary[] = quoteItems.map((item) => {
          const key = String(item.id);

          // Direct costs (project_costs) assigned to this line item
          const itemCosts = projectCosts.filter(
            (c) => c.quote_line_item_key === key
          );
          const direct_costs = itemCosts.reduce((sum, c) => sum + c.amount, 0);

          // Material costs from movements assigned to this line item
          const itemMovements = materialMovements.filter(
            (m) => m.quote_line_item_key === key
          );
          const outgoing = itemMovements
            .filter((m) => m.direction === "outgoing")
            .reduce((sum, m) => sum + m.quantity * m.unit_price, 0);
          const returning = itemMovements
            .filter((m) => m.direction === "returning")
            .reduce((sum, m) => sum + m.quantity * m.unit_price, 0);
          const material_costs = outgoing - returning;

          const ist = direct_costs + material_costs;
          const soll = item.total_price;

          return {
            line_item_key: key,
            position_number: item.position_number,
            product_name: item.product_name,
            soll,
            ist,
            differenz: soll - ist,
            costs: itemCosts,
            material_costs,
          };
        });

        // 7. Handle unassigned costs (no quote_line_item_key) as "Sonstige"
        const unassignedCosts = projectCosts.filter(
          (c) => !c.quote_line_item_key
        );
        if (unassignedCosts.length > 0) {
          const unassignedDirect = unassignedCosts.reduce(
            (sum, c) => sum + c.amount,
            0
          );

          const unassignedMovements = materialMovements.filter(
            (m) => !m.quote_line_item_key
          );
          const unassignedOut = unassignedMovements
            .filter((m) => m.direction === "outgoing")
            .reduce((sum, m) => sum + m.quantity * m.unit_price, 0);
          const unassignedRet = unassignedMovements
            .filter((m) => m.direction === "returning")
            .reduce((sum, m) => sum + m.quantity * m.unit_price, 0);
          const unassignedMaterial = unassignedOut - unassignedRet;

          const unassignedIst = unassignedDirect + unassignedMaterial;

          positions.push({
            line_item_key: "unassigned",
            position_number: 9999,
            product_name: "Sonstige",
            soll: 0,
            ist: unassignedIst,
            differenz: -unassignedIst,
            costs: unassignedCosts,
            material_costs: unassignedMaterial,
          });
        }

        // 8. Calculate totals
        const quote_total =
          quote?.total_amount ??
          positions.reduce((sum, p) => sum + p.soll, 0);
        const total_costs = positions.reduce((sum, p) => sum + p.ist, 0);
        const overhead_amount = total_costs * (overheadPercentage / 100);
        const profit = quote_total - total_costs - overhead_amount;
        const margin_percent =
          quote_total > 0 ? (profit / quote_total) * 100 : 0;

        // 9. Identify open_items
        const open_items: OpenItem[] = [];

        // Positions with soll > 0 but ist === 0
        for (const pos of positions) {
          if (pos.soll > 0 && pos.ist === 0) {
            open_items.push({
              type: "missing_invoice",
              description: `Position ${pos.position_number}: ${pos.product_name} hat keine Ist-Kosten`,
            });
          }
        }

        // Material movements where outgoing > returning (unreturned) for this project
        const productMovementMap = new Map<
          string,
          { outgoing: number; returning: number; name: string }
        >();

        for (const m of materialMovements) {
          const key = m.product?.name ?? m.id;
          const existing = productMovementMap.get(key) ?? {
            outgoing: 0,
            returning: 0,
            name: m.product?.name ?? key,
          };
          if (m.direction === "outgoing") {
            existing.outgoing += m.quantity;
          } else {
            existing.returning += m.quantity;
          }
          productMovementMap.set(key, existing);
        }

        for (const [, val] of productMovementMap) {
          if (val.outgoing > val.returning) {
            open_items.push({
              type: "unreturned_material",
              description: `Material nicht vollständig zurückgegeben: ${val.name} (${val.outgoing - val.returning} Einheiten ausstehend)`,
            });
          }
        }

        // project_costs with status "pending"
        for (const cost of projectCosts) {
          if (cost.status === "pending") {
            open_items.push({
              type: "pending_cost",
              description: `Ausstehende Kosten: ${cost.description} (${cost.amount} €)`,
            });
          }
        }

        const summary: ProjectCostSummary = {
          project_id,
          quote_total,
          total_costs,
          overhead_amount,
          profit,
          margin_percent,
          positions,
          open_items,
        };

        return NextResponse.json({ data: summary });
      }

      // ------------------------------------------------------------------
      case "assign_invoice": {
        const { invoice_id, project_id, assignments } = data as {
          invoice_id: string;
          project_id: string;
          assignments: {
            quote_line_item_key: string;
            amount: number;
            description: string;
          }[];
        };

        if (
          !invoice_id ||
          !project_id ||
          !assignments ||
          !Array.isArray(assignments) ||
          assignments.length === 0
        ) {
          return NextResponse.json(
            {
              error:
                "invoice_id, project_id and assignments are required",
            },
            { status: 400 }
          );
        }

        // Get partner_id from the invoice
        const { data: invoice, error: invoiceError } = await admin
          .from("partner_invoices")
          .select("id, partner_id")
          .eq("id", invoice_id)
          .single();

        if (invoiceError || !invoice) {
          return NextResponse.json(
            { error: invoiceError?.message ?? "Invoice not found" },
            { status: 404 }
          );
        }

        // Find matching subcontractor for the partner
        const { data: subcontractor } = await admin
          .from("subcontractors")
          .select("id")
          .eq("partner_id", invoice.partner_id)
          .limit(1)
          .maybeSingle();

        const subcontractor_id: string | null = subcontractor?.id ?? null;

        // Create project_costs entries for each assignment
        const inserts = assignments.map((a) => ({
          project_id,
          cost_type: "subcontractor_invoice",
          invoice_id,
          quote_line_item_key: a.quote_line_item_key,
          amount: a.amount,
          description: a.description,
          date: new Date().toISOString().slice(0, 10),
          subcontractor_id,
          created_by: user.id,
        }));

        const { data: created, error: insertError } = await admin
          .from("project_costs")
          .insert(inserts)
          .select(COSTS_JOIN);

        if (insertError) {
          return NextResponse.json(
            { error: insertError.message },
            { status: 500 }
          );
        }

        // Update invoice status to reviewed
        const { error: updateError } = await admin
          .from("partner_invoices")
          .update({ status: "reviewed" })
          .eq("id", invoice_id);

        if (updateError) {
          return NextResponse.json(
            { error: updateError.message },
            { status: 500 }
          );
        }

        return NextResponse.json({ data: created as ProjectCost[] });
      }

      // ------------------------------------------------------------------
      default:
        return NextResponse.json(
          { error: "Unknown action" },
          { status: 400 }
        );
    }
  } catch (err: unknown) {
    console.error(`[Costs API] Error:`, err);
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
