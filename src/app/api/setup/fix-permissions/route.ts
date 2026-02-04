import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // Auth check - only superadmin
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("auth_id", user.id)
    .single();

  if (!profile || profile.role !== "superadmin") {
    return NextResponse.json({ error: "Forbidden - Superadmin only" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  // Action: fix-messages - Disable RLS on messages table for debugging
  if (action === "fix-messages") {
    // Der Service Role Key bypassed RLS immer, also testen wir ob die Tabelle funktioniert
    const { data, error } = await supabaseAdmin
      .from("appointment_response_messages")
      .select("*")
      .limit(10);

    return NextResponse.json({
      action: "fix-messages",
      messagesFound: data?.length || 0,
      data,
      error: error?.message,
      hint: "Service role bypasses RLS. If messages exist, issue is RLS policies for authenticated users."
    });
  }

  // Action: disable-messages-rls
  if (action === "disable-messages-rls") {
    // Wir können RLS nicht direkt deaktivieren via REST, aber wir können
    // über die Supabase SQL Editor URL hinweisen
    return NextResponse.json({
      action: "disable-messages-rls",
      sql: `
-- Run this in Supabase SQL Editor:
ALTER TABLE appointment_response_messages DISABLE ROW LEVEL SECURITY;
GRANT ALL ON appointment_response_messages TO authenticated;
      `.trim(),
      dashboardUrl: `https://supabase.com/dashboard/project/veneuojbqyyturxvtxjm/sql/new`
    });
  }

  // Default: info about tables
  const tables = [
    "partner_users", "partners", "partner_jobs", "partner_invoices",
    "job_reports", "partner_job_appointments", "partner_job_subtasks",
    "appointment_responses", "appointment_response_messages", "notifications"
  ];

  const results: Record<string, any> = {};
  for (const table of tables) {
    const { count, error } = await supabaseAdmin
      .from(table)
      .select("*", { count: "exact", head: true });
    results[table] = { count, error: error?.message };
  }

  return NextResponse.json({
    message: "Service role access check",
    tables: results,
    actions: ["fix-messages", "disable-messages-rls"],
    usage: "/api/setup/fix-permissions?action=fix-messages"
  });
}
