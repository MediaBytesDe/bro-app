import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * Track quote events: viewed, accepted, rejected.
 * Called from customer portal when a customer views/accepts/rejects a quote.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { quoteId, event } = await request.json();

    if (!quoteId || !["viewed", "accepted", "rejected"].includes(event)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const updates: Record<string, any> = { updated_at: now };

    switch (event) {
      case "viewed":
        // Only set viewed_at if not already set (first view)
        const { data: quote } = await supabase
          .from("wawi_quotes")
          .select("viewed_at")
          .eq("id", quoteId)
          .single();
        
        if (quote && !quote.viewed_at) {
          updates.viewed_at = now;
        }
        break;
      case "accepted":
        updates.status = "accepted";
        updates.accepted_at = now;
        break;
      case "rejected":
        updates.status = "rejected";
        updates.rejected_at = now;
        break;
    }

    await supabase
      .from("wawi_quotes")
      .update(updates)
      .eq("id", quoteId);

    return NextResponse.json({ success: true, event, timestamp: now });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Tracking failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
