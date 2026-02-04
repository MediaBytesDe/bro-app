import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const LEXWARE_API_KEY = "1hgePA-GyqCIhCbxfkaB1kYlVvVj0kkTBJeJ6BR4GVZ-doqv";
const LEXWARE_BASE_URL = "https://api.lexoffice.io/v1";

async function lexwareRequest(endpoint: string) {
  const response = await fetch(`${LEXWARE_BASE_URL}${endpoint}`, {
    headers: {
      "Authorization": `Bearer ${LEXWARE_API_KEY}`,
      "Accept": "application/json",
    },
  });
  
  if (!response.ok) {
    throw new Error(`Lexware API error: ${response.status}`);
  }
  
  return response.json();
}

// Map Lexware status to our status
function mapStatus(lexwareStatus: string): string {
  switch (lexwareStatus) {
    case "draft": return "draft";
    case "open": return "sent";
    case "accepted": return "accepted";
    case "rejected": return "rejected";
    case "overdue": return "sent";
    default: return "draft";
  }
}

// Try to find a matching product by name (fuzzy)
function findProductByName(name: string, products: any[]): any | null {
  const normalizedName = name.toLowerCase().trim();
  
  // Direct match
  let match = products.find(p => p.name.toLowerCase() === normalizedName);
  if (match) return match;
  
  // Partial match - product name contains search or vice versa
  match = products.find(p => 
    normalizedName.includes(p.name.toLowerCase()) || 
    p.name.toLowerCase().includes(normalizedName)
  );
  if (match) return match;
  
  // Keyword matching for common products
  const keywords: Record<string, string[]> = {
    "trina": ["trina", "modul", "445w", "440w"],
    "unterkonstruktion": ["unterkonstruktion", "uk"],
    "dc-montage": ["dc-montage", "dc montage"],
    "ac-montage": ["ac-montage", "ac montage"],
    "wechselrichter": ["wechselrichter", "hybrid", "sh8", "sh10", "sh15"],
    "speicher": ["speicher", "sbr", "batterie", "kwh"],
    "wallbox": ["wallbox", "ev charger", "ladestation", "22kw"],
    "ihomemanager": ["ihome", "home manager", "energiemanager"],
    "zählerschrank": ["zähler", "umbau"],
    "netzantrag": ["netzantrag", "inbetriebnahme"],
  };
  
  for (const [productType, kws] of Object.entries(keywords)) {
    if (kws.some(kw => normalizedName.includes(kw))) {
      match = products.find(p => kws.some(kw => p.name.toLowerCase().includes(kw)));
      if (match) return match;
    }
  }
  
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { reset } = await request.json().catch(() => ({}));
    const supabase = await createClient();
    
    // Optional: Delete all existing imported quotes for re-import
    if (reset) {
      await supabase.from("wawi_quote_items").delete().neq("quote_id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("wawi_quotes").delete().not("lexware_quotation_id", "is", null);
    }
    
    // 1. Fetch all quotations from Lexware
    const voucherList = await lexwareRequest("/voucherlist?voucherType=quotation&voucherStatus=draft,open,accepted,rejected&size=100");
    
    if (!voucherList.content || voucherList.content.length === 0) {
      return NextResponse.json({ message: "Keine Angebote in Lexware gefunden", imported: 0 });
    }

    // 2. Get existing quotes to avoid duplicates
    const { data: existingQuotes } = await supabase
      .from("wawi_quotes")
      .select("lexware_quotation_id");
    
    const existingIds = new Set(existingQuotes?.map(q => q.lexware_quotation_id) || []);

    // 3. Get all customers with lexware_id
    const { data: customers } = await supabase
      .from("customers")
      .select("id, lexware_id, first_name, last_name, company_name");
    
    const customerByLexwareId = new Map(
      customers?.filter(c => c.lexware_id).map(c => [c.lexware_id, c]) || []
    );

    // 4. Get all products for price lookup
    const { data: products } = await supabase
      .from("products")
      .select("id, name, sku, net_selling_price, cost_price");

    const imported: any[] = [];
    const skipped: any[] = [];
    const errors: any[] = [];

    // 5. Import each quotation
    for (const voucher of voucherList.content) {
      // Skip if already exists
      if (existingIds.has(voucher.id)) {
        skipped.push({ number: voucher.voucherNumber, reason: "already exists" });
        continue;
      }

      try {
        // Fetch full quotation details
        const quote = await lexwareRequest(`/quotations/${voucher.id}`);
        
        // Find customer by contact ID
        const contactId = quote.address?.contactId;
        const customer = contactId ? customerByLexwareId.get(contactId) : null;

        if (!customer) {
          errors.push({ 
            number: voucher.voucherNumber, 
            error: `Customer not found for contact ${contactId} (${voucher.contactName})` 
          });
          continue;
        }

        // Extract line items
        const lineItems = quote.lineItems || [];
        
        // Check if it's a package deal (first item has full price, rest are 0)
        const isPackageDeal = lineItems.length > 1 && 
          lineItems.slice(1).every((item: any) => item.unitPrice?.netAmount === 0);
        
        const packageTitle = isPackageDeal ? lineItems[0]?.name : null;
        const packagePrice = isPackageDeal ? lineItems[0]?.unitPrice?.netAmount : null;

        // Build items with real prices from products table
        const itemsData = lineItems
          .filter((item: any, index: number) => !isPackageDeal || index > 0)
          .map((item: any) => {
            // Try to find matching product
            const product = findProductByName(item.name, products || []);
            const realPrice = product?.net_selling_price || item.unitPrice?.netAmount || 0;
            const costPrice = product?.cost_price || 0;
            
            return {
              product_id: product?.id || null,
              product_name: item.name,
              product_description: item.description || null,
              quantity: item.quantity || 1,
              unit: item.unitName || "Stück",
              unit_price: realPrice,
              purchase_price: costPrice,
              total_price: realPrice * (item.quantity || 1),
              tax_rate: item.unitPrice?.taxRatePercentage || 0,
              discount_percentage: item.discountPercentage || 0,
            };
          });

        // Calculate subtotal from real prices
        const subtotal = itemsData.reduce((sum: number, item: any) => sum + item.total_price, 0);
        const totalPurchase = itemsData.reduce((sum: number, item: any) => sum + (item.purchase_price * item.quantity), 0);
        const margin = subtotal > 0 ? ((subtotal - totalPurchase) / subtotal) * 100 : 0;

        // Create quote record
        const quoteData = {
          customer_id: customer.id,
          title: quote.title || "Angebot",
          quote_date: quote.voucherDate?.split("T")[0] || new Date().toISOString().split("T")[0],
          valid_until: quote.expirationDate?.split("T")[0] || null,
          status: mapStatus(voucher.voucherStatus),
          is_package_deal: isPackageDeal,
          package_title: packageTitle,
          package_price: packagePrice,
          subtotal: isPackageDeal ? subtotal : (quote.totalPrice?.totalNetAmount || subtotal),
          total_amount: quote.totalPrice?.totalNetAmount || packagePrice || subtotal,
          total_margin: subtotal - totalPurchase,
          margin_percentage: margin,
          tax_type: "pv",
          tax_rate: 0,
          tax_amount: 0,
          introduction: quote.introduction || null,
          remark: quote.remark || null,
          lexware_quotation_id: voucher.id,
          lexware_quote_number: voucher.voucherNumber,
        };

        const { data: newQuote, error: insertError } = await supabase
          .from("wawi_quotes")
          .insert(quoteData)
          .select("id")
          .single();

        if (insertError) {
          errors.push({ number: voucher.voucherNumber, error: insertError.message });
          continue;
        }

        // Create quote items
        if (itemsData.length > 0) {
          const itemsToInsert = itemsData.map((item: any, index: number) => ({
            ...item,
            quote_id: newQuote.id,
            position_number: index + 1,
          }));
          await supabase.from("wawi_quote_items").insert(itemsToInsert);
        }

        imported.push({
          number: voucher.voucherNumber,
          customer: `${customer.first_name} ${customer.last_name}`,
          amount: voucher.totalAmount,
          status: quoteData.status,
          itemsWithPrice: itemsData.filter((i: any) => i.unit_price > 0).length,
          itemsTotal: itemsData.length,
        });

      } catch (err: any) {
        errors.push({ number: voucher.voucherNumber, error: err.message });
      }
    }

    return NextResponse.json({
      message: `Import abgeschlossen`,
      total: voucherList.content.length,
      imported: imported.length,
      skipped: skipped.length,
      errors: errors.length,
      details: { imported, skipped, errors },
    });

  } catch (error: any) {
    console.error("Import error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
