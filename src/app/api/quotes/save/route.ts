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

  const admin = createAdminClient();

  try {
    let savedQuoteId = quoteId;

    if (quoteId) {
      // Update existing quote
      const { error: updateError } = await admin
        .from("wawi_quotes")
        .update({ ...quoteData, updated_at: new Date().toISOString() })
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
        .insert({ ...quoteData, created_by: user.id })
        .select("id")
        .single();

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }

      savedQuoteId = newQuote?.id;
    }

    // Insert items
    if (savedQuoteId && items && items.length > 0) {
      const itemsWithQuoteId = items.map((item: any, i: number) => {
        // Strip client-only fields
        const { _id, id, ...rest } = item;
        return {
          ...rest,
          quote_id: savedQuoteId,
          position_number: i + 1,
        };
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
