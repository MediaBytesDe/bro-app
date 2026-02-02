import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncCustomerToLexware, syncCustomersToLexware, importFromLexware } from "@/lib/lexware/sync";

/**
 * POST /api/lexware/sync
 * 
 * Sync customers to Lexware
 * Body: { customerId?: string, customerIds?: string[], action?: "export" | "import" }
 */
export async function POST(request: Request) {
  // Check auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check role (only admin/mitarbeiter can sync)
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("auth_id", user.id)
    .single();

  if (!profile || !["admin", "mitarbeiter"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { customerId, customerIds, action = "export" } = body;

    // Import from Lexware
    if (action === "import") {
      const result = await importFromLexware();
      return NextResponse.json({
        success: true,
        action: "import",
        ...result,
      });
    }

    // Export single customer
    if (customerId) {
      const result = await syncCustomerToLexware(customerId);
      return NextResponse.json(result);
    }

    // Export multiple customers
    if (customerIds?.length) {
      const results = await syncCustomersToLexware(customerIds);
      const success = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      return NextResponse.json({
        success: failed === 0,
        action: "batch",
        total: results.length,
        synced: success,
        failed,
        results,
      });
    }

    // Export all active customers
    const results = await syncCustomersToLexware();
    const success = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: failed === 0,
      action: "batch_all",
      total: results.length,
      synced: success,
      failed,
      results,
    });
  } catch (err) {
    console.error("Lexware sync error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
