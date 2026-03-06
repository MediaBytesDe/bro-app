import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OverheadSettings } from "@/types/nachkalkulation";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const body = await req.json();
  const { action } = body;

  try {
    switch (action) {
      case "get": {
        const year: number =
          typeof body.year === "number"
            ? body.year
            : new Date().getFullYear();

        const { data, error } = await admin
          .from("overhead_settings")
          .select("*")
          .eq("year", year)
          .maybeSingle();

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data: data as OverheadSettings | null });
      }

      case "upsert": {
        const { year, planned_revenue, planned_overhead_costs } = body as {
          year: number;
          planned_revenue: number;
          planned_overhead_costs: number;
        };

        if (
          typeof year !== "number" ||
          typeof planned_revenue !== "number" ||
          typeof planned_overhead_costs !== "number"
        ) {
          return NextResponse.json(
            { error: "year, planned_revenue and planned_overhead_costs are required numbers" },
            { status: 400 }
          );
        }

        const { data, error } = await admin
          .from("overhead_settings")
          .upsert(
            { year, planned_revenue, planned_overhead_costs },
            { onConflict: "year" }
          )
          .select()
          .single();

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data: data as OverheadSettings });
      }

      case "list": {
        const { data, error } = await admin
          .from("overhead_settings")
          .select("*")
          .order("year", { ascending: false });

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data: data as OverheadSettings[] });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[Overhead API] Error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
