import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ShopifyProductResponse, ShopifyProduct } from "@/types/shopify";

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

    const { productUrl } = await request.json();

    if (!productUrl || !productUrl.includes("solarhandel24.de/products/")) {
      return NextResponse.json(
        { error: "Ungültige Solarhandel24 Produkt-URL" },
        { status: 400 }
      );
    }

    // Construct JSON API URL
    const jsonUrl = productUrl.replace(/\.json$/, "") + ".json";

    // Fetch product data from Shopify
    const shopifyResponse = await fetch(jsonUrl, {
      headers: {
        "Accept": "application/json",
      },
    });

    if (!shopifyResponse.ok) {
      return NextResponse.json(
        { error: `Produkt konnte nicht geladen werden: ${shopifyResponse.statusText}` },
        { status: shopifyResponse.status }
      );
    }

    const shopifyData: ShopifyProductResponse = await shopifyResponse.json();
    const product = shopifyData.product;

    if (!product) {
      return NextResponse.json(
        { error: "Kein Produkt in der Antwort gefunden" },
        { status: 404 }
      );
    }

    // Map Shopify data to BROjekt product schema
    const mappedProduct = mapShopifyProduct(product, productUrl);

    // Check if product with this SKU already exists
    const { data: existingProduct } = await supabase
      .from("products")
      .select("id")
      .eq("sku", mappedProduct.sku)
      .single();

    let result;
    if (existingProduct) {
      // Update existing product
      const { data, error } = await supabase
        .from("products")
        .update(mappedProduct)
        .eq("id", existingProduct.id)
        .select()
        .single();

      if (error) throw error;
      result = { action: "updated", product: data };
    } else {
      // Insert new product
      const { data, error } = await supabase
        .from("products")
        .insert(mappedProduct)
        .select()
        .single();

      if (error) throw error;
      result = { action: "created", product: data };
    }

    return NextResponse.json(result, { status: 200 });

  } catch (error: unknown) {
    console.error("Shopify import error:", error);
    const message = error instanceof Error ? error.message : "Import fehlgeschlagen";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

function mapShopifyProduct(shopifyProduct: ShopifyProduct, sourceUrl: string) {
  // Get first variant (usually the base variant)
  const firstVariant = shopifyProduct.variants?.[0];
  const sku = firstVariant?.sku || shopifyProduct.id.toString();
  const purchasePrice = parseFloat(firstVariant?.price || "0");

  // Get main image
  const mainImage = shopifyProduct.images?.[0]?.src || shopifyProduct.image?.src || null;

  // Determine category from tags
  const tags = shopifyProduct.tags || [];
  let category = "Zubehör"; // Default
  if (tags.includes("Solarmodule")) category = "Trina Solar";
  else if (tags.some((t: string) => t.toLowerCase().includes("wechselrichter"))) category = "Wechselrichter";
  else if (tags.some((t: string) => t.toLowerCase().includes("speicher"))) category = "Speicher";
  else if (tags.some((t: string) => t.toLowerCase().includes("montage"))) category = "Aufdach-Montage";

  // System defaults for calculation
  const overheadPercentage = 25; // 25% Gemeinkosten
  const profitMargin = 30; // 30% Gewinnaufschlag
  const taxRate = 19; // 19% MwSt

  // Calculate prices using the same logic as live-calculation.tsx
  const supplierDiscount = 0; // No discount by default
  const supplierSkonto = 0; // No skonto by default
  const purchaseCosts = 0; // No additional costs

  const targetPurchasePrice = purchasePrice * (1 - supplierDiscount / 100);
  const barePurchasePrice = targetPurchasePrice * (1 - supplierSkonto / 100);
  const referencePrice = barePurchasePrice + purchaseCosts;
  const handlingCosts = referencePrice * (overheadPercentage / 100);
  const costPrice = referencePrice + handlingCosts;
  const profitAmount = costPrice * (profitMargin / 100);
  const bareSellingPrice = costPrice + profitAmount;
  const customerSkonto = 0;
  const customerSkontoAmount = bareSellingPrice * (customerSkonto / 100);
  const targetSellingPrice = bareSellingPrice + customerSkontoAmount;
  const customerDiscount = 0;
  const customerDiscountAmount = targetSellingPrice * (customerDiscount / 100);
  const netSellingPrice = targetSellingPrice + customerDiscountAmount;
  const taxAmount = netSellingPrice * (taxRate / 100);
  const grossSellingPrice = netSellingPrice + taxAmount;

  return {
    name: shopifyProduct.title,
    description: stripHtml(shopifyProduct.body_html || ""),
    category,
    manufacturer: shopifyProduct.vendor || null,
    sku,
    purchase_list_price: purchasePrice,
    supplier_discount: supplierDiscount,
    supplier_skonto: supplierSkonto,
    purchase_costs: purchaseCosts,
    overhead_percentage: overheadPercentage,
    profit_margin: profitMargin,
    customer_skonto: customerSkonto,
    default_customer_discount: customerDiscount,
    tax_rate: taxRate,
    target_purchase_price: targetPurchasePrice,
    bare_purchase_price: barePurchasePrice,
    reference_price: referencePrice,
    cost_price: costPrice,
    bare_selling_price: bareSellingPrice,
    target_selling_price: targetSellingPrice,
    net_selling_price: netSellingPrice,
    gross_selling_price: grossSellingPrice,
    recommended_retail_price: grossSellingPrice,
    stock_quantity: 0, // We don't sync inventory
    min_stock_level: 1,
    unit: "Stück",
    standard_quantity: 1,
    status: "active",
    source_url: sourceUrl,
    source_type: "shopify",
    source_product_id: shopifyProduct.id.toString(),
    image_url: mainImage,
    last_sync_at: new Date().toISOString(),
  };
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "") // Remove HTML tags
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}
