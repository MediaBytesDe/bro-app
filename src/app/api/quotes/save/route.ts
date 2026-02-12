import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  // Verify user is authenticated
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { quoteId, quoteData, items } = body;

  // Only include columns that exist in wawi_quotes
  const ALLOWED_QUOTE_COLS = new Set([
    'customer_id', 'title', 'quote_date', 'valid_until', 'tax_type',
    'is_package_deal', 'package_title', 'package_price', 'package_surcharge',
    'status', 'subtotal', 'discount_percentage', 'discount_amount',
    'tax_rate', 'tax_amount', 'total_amount', 'total_margin',
    'margin_percentage', 'introduction', 'remark', 'internal_notes',
    'notes', 'rounding_amount', 'quote_number',
    'lexware_quotation_id', 'lexware_quote_number',
  ]);

  const cleanedQuoteData: Record<string, any> = {};
  for (const [key, value] of Object.entries(quoteData)) {
    if (ALLOWED_QUOTE_COLS.has(key)) {
      cleanedQuoteData[key] = value;
    }
  }

  const admin = createAdminClient();

  try {
    let savedQuoteId = quoteId;

    if (quoteId) {
      // Update existing quote
      const { error: updateError } = await admin
        .from("wawi_quotes")
        .update({ ...cleanedQuoteData, updated_at: new Date().toISOString() })
        .eq("id", quoteId);

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      // Delete old items
      await admin.from("wawi_quote_items").delete().eq("quote_id", quoteId);
    } else {
      // Create new quote
      const { data: newQuote, error: insertError } = await admin
        .from("wawi_quotes")
        .insert(cleanedQuoteData)
        .select("id")
        .single();

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      savedQuoteId = newQuote?.id;
    }

    // Insert items
    const ALLOWED_ITEM_COLS = new Set([
      'product_id', 'product_name', 'product_description', 'sku',
      'quantity', 'unit', 'purchase_price', 'unit_price',
      'discount_percentage', 'total_price', 'tax_rate', 'tax_amount',
      'margin_amount', 'margin_percentage', 'is_package_deal',
    ]);

    if (savedQuoteId && items && items.length > 0) {
      const itemsWithQuoteId = items.map((item: any, i: number) => {
        const cleaned: Record<string, any> = {
          quote_id: savedQuoteId,
          position_number: i + 1,
        };
        for (const [key, value] of Object.entries(item)) {
          if (ALLOWED_ITEM_COLS.has(key)) {
            cleaned[key] = value;
          }
        }
        return cleaned;
      });

      const { error: itemsError } = await admin
        .from("wawi_quote_items")
        .insert(itemsWithQuoteId);

      if (itemsError) {
        return NextResponse.json({ error: `Items: ${itemsError.message}` }, { status: 500 });
      }
    }

    return NextResponse.json({ id: savedQuoteId });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
