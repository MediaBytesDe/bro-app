import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: 'public' } }
  );

  const results: any[] = [];

  // Run SQL via supabase-js .from() won't work for DDL, use the SQL endpoint
  const sqlStatements = [
    `CREATE TABLE IF NOT EXISTS partner_material_requests (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      partner_id uuid NOT NULL REFERENCES partners(id),
      job_id uuid REFERENCES partner_jobs(id),
      project_id uuid REFERENCES projects(id),
      requested_by uuid REFERENCES partner_users(id),
      title text NOT NULL,
      description text,
      items jsonb DEFAULT '[]'::jsonb,
      urgency text DEFAULT 'normal',
      status text DEFAULT 'requested',
      delivery_address text,
      needed_by date,
      notes text,
      admin_notes text,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS partner_availability (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      partner_id uuid NOT NULL REFERENCES partners(id),
      partner_user_id uuid REFERENCES partner_users(id),
      date date NOT NULL,
      status text DEFAULT 'available',
      capacity_percent int DEFAULT 100,
      notes text,
      created_at timestamptz DEFAULT now(),
      UNIQUE(partner_id, partner_user_id, date)
    )`,
    `ALTER TABLE partner_material_requests ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE partner_availability ENABLE ROW LEVEL SECURITY`,
  ];

  // Execute via Supabase Management API (pg_net or direct)
  for (const sql of sqlStatements) {
    try {
      const { data, error } = await supabase.rpc('execute_sql', { sql_query: sql });
      results.push({ sql: sql.substring(0, 60), data, error: error?.message });
    } catch (e: any) {
      results.push({ sql: sql.substring(0, 60), error: e.message });
    }
  }

  return NextResponse.json({ results, note: "Use Supabase Dashboard SQL Editor to run DDL" });
}
