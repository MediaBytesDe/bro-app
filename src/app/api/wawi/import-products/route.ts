import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const OLD_WAWI_URL = "https://wawi.sofort.solar/api/products";
const OLD_WAWI_API_KEY = "sk_Xy1SC0aZycbG7xz1SN1gvqWY59SWkthbpMRBUvsCOS94kolO";

export async function POST(request: NextRequest) {
  try {
    // Auth check - only admin/mitarbeiter/superadmin
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check role
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("auth_id", user.id)
      .single();

    if (!profile || !["admin", "mitarbeiter", "superadmin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch products from old WAWI system
    const response = await fetch(OLD_WAWI_URL, {
      headers: {
        "Authorization": `Bearer ${OLD_WAWI_API_KEY}`,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch from old WAWI: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const products = data.success ? data.data : [];

    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        { error: "No products found in old WAWI system" },
        { status: 404 }
      );
    }

    // Import each product
    const results = {
      total: products.length,
      created: 0,
      updated: 0,
      errors: [] as Array<{ sku: string; error: string }>,
    };

    for (const oldProduct of products) {
      try {
        // Map old WAWI product to new schema
        const mappedProduct = mapOldWawiProduct(oldProduct);

        // Check if product with this SKU already exists
        const { data: existingProduct } = await supabase
          .from("products")
          .select("id")
          .eq("sku", mappedProduct.sku)
          .single();

        if (existingProduct) {
          // Update existing product
          const { error } = await supabase
            .from("products")
            .update(mappedProduct)
            .eq("id", existingProduct.id);

          if (error) throw error;
          results.updated++;
        } else {
          // Insert new product
          const { error } = await supabase
            .from("products")
            .insert(mappedProduct);

          if (error) throw error;
          results.created++;
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        results.errors.push({
          sku: oldProduct.sku || "unknown",
          error: message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
    }, { status: 200 });

  } catch (error: unknown) {
    console.error("Old WAWI import error:", error);
    const message = error instanceof Error ? error.message : "Import failed";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

function mapOldWawiProduct(oldProduct: any) {
  return {
    name: oldProduct.name,
    description: oldProduct.description || null,
    category: oldProduct.category,
    manufacturer: oldProduct.manufacturer || null,
    sku: oldProduct.sku,
    purchase_list_price: parseFloat(oldProduct.purchase_list_price) || 0,
    supplier_discount: parseFloat(oldProduct.supplier_discount) || 0,
    supplier_skonto: parseFloat(oldProduct.supplier_skonto) || 0,
    purchase_costs: parseFloat(oldProduct.purchase_costs) || 0,
    overhead_percentage: parseFloat(oldProduct.overhead_percentage) || 25,
    profit_margin: parseFloat(oldProduct.profit_margin) || 30,
    customer_skonto: parseFloat(oldProduct.customer_skonto) || 0,
    default_customer_discount: parseFloat(oldProduct.default_customer_discount) || 0,
    tax_rate: parseFloat(oldProduct.tax_rate) || 19,
    target_purchase_price: parseFloat(oldProduct.target_purchase_price) || 0,
    bare_purchase_price: parseFloat(oldProduct.bare_purchase_price) || 0,
    reference_price: parseFloat(oldProduct.reference_price) || 0,
    cost_price: parseFloat(oldProduct.cost_price) || 0,
    bare_selling_price: parseFloat(oldProduct.bare_selling_price) || 0,
    target_selling_price: parseFloat(oldProduct.target_selling_price) || 0,
    net_selling_price: parseFloat(oldProduct.net_selling_price) || 0,
    gross_selling_price: parseFloat(oldProduct.gross_selling_price) || 0,
    recommended_retail_price: parseFloat(oldProduct.recommended_retail_price) || 0,
    stock_quantity: parseInt(oldProduct.stock_quantity) || 0,
    min_stock_level: parseInt(oldProduct.min_stock_level) || 1,
    unit: oldProduct.unit || "Stück",
    standard_quantity: parseFloat(oldProduct.standard_quantity) || 1,
    status: oldProduct.status || "active",
    source_type: "manual", // Mark as manual import from old system
    last_sync_at: new Date().toISOString(),
  };
}
