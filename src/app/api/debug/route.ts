import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    env: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? "set" : "MISSING",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "set" : "MISSING",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? "set" : "MISSING",
      LEXWARE_API_KEY: process.env.LEXWARE_API_KEY ? "set" : "MISSING",
      OPENCLAW_URL: process.env.OPENCLAW_URL || "not set",
      HOSTNAME: process.env.HOSTNAME || "not set",
      NODE_ENV: process.env.NODE_ENV,
    },
  };

  // Test Supabase connection
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    results.auth = {
      user: user ? { id: user.id, email: user.email } : null,
      error: authError?.message || null,
    };

    // Test key tables
    const tables = ["customers", "leads", "wawi_quotes", "users", "projects", "appointments"];
    results.tables = {};
    for (const table of tables) {
      const { data, error } = await supabase.from(table).select("id").limit(1);
      results.tables[table] = {
        ok: !error,
        count: data?.length ?? 0,
        error: error?.message || null,
      };
    }
  } catch (err) {
    results.supabaseError = String(err);
  }

  // Test Lexware API
  try {
    const res = await fetch("https://api.lexoffice.io/v1/voucherlist?voucherType=quotation&voucherStatus=open&page=0&size=1", {
      headers: { Authorization: `Bearer ${process.env.LEXWARE_API_KEY}` },
    });
    results.lexware = { status: res.status, ok: res.ok };
  } catch (err) {
    results.lexware = { error: String(err) };
  }

  return NextResponse.json(results, { status: 200 });
}
