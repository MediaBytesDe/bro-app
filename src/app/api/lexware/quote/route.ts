import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLexwareClient, LexwareClient } from "@/lib/lexware/client";

/**
 * POST /api/lexware/quote
 * 
 * Sync a quote to Lexware
 * Body: { quoteId: string }
 */
export async function POST(request: Request) {
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

  if (!profile || !["admin", "mitarbeiter"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { quoteId } = await request.json();

    if (!quoteId) {
      return NextResponse.json({ error: "quoteId required" }, { status: 400 });
    }

    // Get quote with customer
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select("*, customers(id, lexware_id)")
      .eq("id", quoteId)
      .single();

    if (quoteError || !quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    // Check if customer has Lexware ID
    if (!quote.customers?.lexware_id) {
      return NextResponse.json(
        { error: "Customer must be synced to Lexware first" },
        { status: 400 }
      );
    }

    const lexware = getLexwareClient();

    // Convert quote to Lexware format
    const lexwareQuotation = LexwareClient.quoteToQuotation(
      {
        line_items: quote.line_items || [],
        introduction: quote.introduction,
        payment_terms: quote.payment_terms,
        valid_until: quote.valid_until,
        tax_rate: quote.tax_rate,
      },
      quote.customers.lexware_id
    );

    // Check if already synced
    if (quote.lexware_quote_id) {
      // Update existing quotation
      // Note: Lexware API may not support updates - check their docs
      return NextResponse.json({
        success: true,
        action: "already_synced",
        lexwareQuoteId: quote.lexware_quote_id,
      });
    }

    // Create new quotation
    const result = await lexware.createQuotation(lexwareQuotation);

    // Save Lexware ID to DB
    await supabase
      .from("quotes")
      .update({
        lexware_quote_id: result.id,
        lexware_sync_at: new Date().toISOString(),
      })
      .eq("id", quoteId);

    return NextResponse.json({
      success: true,
      action: "created",
      lexwareQuoteId: result.id,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
