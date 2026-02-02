import { NextRequest, NextResponse } from "next/server";
import { importFromLexware, syncCustomerToLexware } from "@/lib/lexware/sync";

// POST /api/lexware/customers - Sync operations
export async function POST(req: NextRequest) {
  try {
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
    console.error("Lexware API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
