import { NextRequest, NextResponse } from "next/server";
import { importFromLexware, syncCustomerToLexware } from "@/lib/lexware/sync";
import { createClient } from "@/lib/supabase/server";

// POST /api/lexware/customers - Sync operations
export async function POST(req: NextRequest) {
  try {
    // Auth check - only admin/mitarbeiter
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

    const body = await req.json();
    const { action, customerId } = body;

    if (action === "import") {
      // Import all customers from Lexware
      const result = await importFromLexware();
      return NextResponse.json(result);
    }

    if (action === "sync" && customerId) {
      // Sync single customer to Lexware
      const result = await syncCustomerToLexware(customerId);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
