import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const LEXWARE_API_KEY = process.env.LEXWARE_API_KEY;
const LEXWARE_BASE_URL = "https://api.lexoffice.io/v1";

async function lexwareRequest(endpoint: string) {
  const response = await fetch(`${LEXWARE_BASE_URL}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${LEXWARE_API_KEY}`,
      Accept: "application/json",
    },
  });
  if (!response.ok) throw new Error(`Lexware API error: ${response.status}`);
  return response.json();
}

function mapLexwareStatus(status: string): string {
  switch (status) {
    case "draft": return "draft";
    case "open": return "sent";
    case "accepted": return "accepted";
    case "rejected": return "rejected";
    default: return "sent";
  }
}

/**
 * POST /api/lexware/sync-quote-status
 * 
 * Bidirectional status sync for quotes already linked to Lexware.
 * - Fetches current status from Lexware for all linked quotes
 * - Updates local DB with Lexware status + timestamps
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("auth_id", user.id)
      .single();

    if (!profile || !["admin", "mitarbeiter", "superadmin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!LEXWARE_API_KEY) {
      return NextResponse.json({ error: "LEXWARE_API_KEY not configured" }, { status: 500 });
    }

    // Get all quotes with Lexware IDs
    const { data: linkedQuotes } = await supabase
      .from("wawi_quotes")
      .select("id, lexware_quotation_id, status, sent_at, accepted_at, rejected_at")
      .not("lexware_quotation_id", "is", null);

    if (!linkedQuotes || linkedQuotes.length === 0) {
      return NextResponse.json({ message: "No linked quotes found", synced: 0 });
    }

    const results: any[] = [];
    const now = new Date().toISOString();

    for (const quote of linkedQuotes) {
      try {
        const lexwareQuote = await lexwareRequest(`/quotations/${quote.lexware_quotation_id}`);
        const newStatus = mapLexwareStatus(lexwareQuote.voucherStatus);

        // Only update if status changed
        if (newStatus !== quote.status) {
          const updates: Record<string, any> = {
            status: newStatus,
            updated_at: now,
          };

          // Set tracking timestamps
          if (newStatus === "sent" && !quote.sent_at) {
            updates.sent_at = now;
          }
          if (newStatus === "accepted" && !quote.accepted_at) {
            updates.accepted_at = now;
          }
          if (newStatus === "rejected" && !quote.rejected_at) {
            updates.rejected_at = now;
          }

          await supabase
            .from("wawi_quotes")
            .update(updates)
            .eq("id", quote.id);

          results.push({
            id: quote.id,
            lexwareId: quote.lexware_quotation_id,
            oldStatus: quote.status,
            newStatus,
            updated: true,
          });
        } else {
          results.push({
            id: quote.id,
            status: quote.status,
            updated: false,
          });
        }
      } catch (err: any) {
        results.push({
          id: quote.id,
          error: err.message,
          updated: false,
        });
      }
    }

    const updated = results.filter((r) => r.updated).length;
    return NextResponse.json({
      message: `Status-Sync abgeschlossen: ${updated}/${linkedQuotes.length} aktualisiert`,
      total: linkedQuotes.length,
      synced: updated,
      results,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
