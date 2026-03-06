import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MaterialMovement } from "@/types/nachkalkulation";

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
  const { action } = body;

  try {
    switch (action) {
      case "list": {
        const { project_id } = body as { action: string; project_id: string };

        if (!project_id) {
          return NextResponse.json(
            { error: "project_id is required" },
            { status: 400 }
          );
        }

        const { data, error } = await admin
          .from("material_movements")
          .select(
            "*, product:products(name, sku, unit, purchase_list_price), subcontractor:subcontractors(company_name)"
          )
          .eq("project_id", project_id)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false });

        if (error) {
          console.error("[Material API] list error:", error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data: data as MaterialMovement[] });
      }

      case "create": {
        const {
          product_id,
          project_id,
          subcontractor_id,
          quote_line_item_key,
          direction,
          quantity,
          date,
          notes,
        } = body as {
          action: string;
          product_id: string;
          project_id: string;
          subcontractor_id?: string;
          quote_line_item_key?: string;
          direction: "outgoing" | "returning";
          quantity: number;
          date?: string;
          notes?: string;
        };

        if (!product_id || !project_id || !direction || quantity == null) {
          return NextResponse.json(
            { error: "product_id, project_id, direction, and quantity are required" },
            { status: 400 }
          );
        }

        // Fetch product to get purchase_list_price for unit_price
        const { data: product, error: productError } = await admin
          .from("products")
          .select("purchase_list_price")
          .eq("id", product_id)
          .single();

        if (productError || !product) {
          console.error("[Material API] product fetch error:", productError);
          return NextResponse.json(
            { error: productError?.message ?? "Product not found" },
            { status: 500 }
          );
        }

        const insertData: Record<string, unknown> = {
          product_id,
          project_id,
          direction,
          quantity,
          unit_price: product.purchase_list_price,
          created_by: user.id,
        };

        if (subcontractor_id !== undefined) insertData.subcontractor_id = subcontractor_id;
        if (quote_line_item_key !== undefined) insertData.quote_line_item_key = quote_line_item_key;
        if (date !== undefined) insertData.date = date;
        if (notes !== undefined) insertData.notes = notes;

        const { data, error } = await admin
          .from("material_movements")
          .insert(insertData)
          .select(
            "*, product:products(name, sku, unit, purchase_list_price), subcontractor:subcontractors(company_name)"
          )
          .single();

        if (error) {
          console.error("[Material API] create error:", error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data: data as MaterialMovement });
      }

      case "project_summary": {
        const { project_id } = body as { action: string; project_id: string };

        if (!project_id) {
          return NextResponse.json(
            { error: "project_id is required" },
            { status: 400 }
          );
        }

        const { data: movements, error } = await admin
          .from("material_movements")
          .select(
            "product_id, direction, quantity, unit_price, product:products(name, sku, unit)"
          )
          .eq("project_id", project_id);

        if (error) {
          console.error("[Material API] project_summary error:", error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Group by product_id and aggregate quantities + costs
        const summaryMap = new Map<
          string,
          {
            product_id: string;
            product_name: string;
            sku: string;
            unit: string;
            total_outgoing: number;
            total_returning: number;
            net_consumption: number;
            cost: number;
          }
        >();

        for (const movement of movements ?? []) {
          const pid = movement.product_id as string;
          const product = movement.product as unknown as {
            name: string;
            sku: string;
            unit: string;
          } | null;

          if (!summaryMap.has(pid)) {
            summaryMap.set(pid, {
              product_id: pid,
              product_name: product?.name ?? "",
              sku: product?.sku ?? "",
              unit: product?.unit ?? "",
              total_outgoing: 0,
              total_returning: 0,
              net_consumption: 0,
              cost: 0,
            });
          }

          const entry = summaryMap.get(pid)!;
          const qty = Number(movement.quantity);
          const unitPrice = Number(movement.unit_price);

          if (movement.direction === "outgoing") {
            entry.total_outgoing += qty;
            entry.cost += qty * unitPrice;
          } else if (movement.direction === "returning") {
            entry.total_returning += qty;
            entry.cost -= qty * unitPrice;
          }
        }

        const summaryData = Array.from(summaryMap.values()).map((entry) => ({
          ...entry,
          net_consumption: entry.total_outgoing - entry.total_returning,
        }));

        return NextResponse.json({ data: summaryData });
      }

      case "low_stock": {
        // Supabase JS client does not support column-to-column comparisons natively,
        // so we fetch all active products and filter stock_quantity <= min_stock_level in JS.
        const { data: products, error: productsError } = await admin
          .from("products")
          .select("id, name, sku, unit, stock_quantity, min_stock_level, purchase_list_price")
          .eq("status", "active")
          .order("stock_quantity", { ascending: true });

        if (productsError) {
          console.error("[Material API] low_stock error:", productsError);
          return NextResponse.json({ error: productsError.message }, { status: 500 });
        }

        const filtered = (products ?? []).filter(
          (p) => p.stock_quantity <= p.min_stock_level
        );

        return NextResponse.json({ data: filtered });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error(`[Material API] Error:`, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
