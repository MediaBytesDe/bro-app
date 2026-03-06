import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
        const { project_id } = body as { action: "get"; project_id: string };

        if (!project_id) {
          return NextResponse.json(
            { error: "project_id is required" },
            { status: 400 }
          );
        }

        const { data: row, error } = await admin
          .from("project_calculation_status")
          .select("*")
          .eq("project_id", project_id)
          .maybeSingle();

        if (error) {
          console.error("[CalcStatus API] get error:", error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (!row) {
          return NextResponse.json({
            data: { status: "open", project_id },
          });
        }

        return NextResponse.json({ data: row });
      }

      case "update": {
        const { project_id, status, notes } = body as {
          action: "update";
          project_id: string;
          status: "open" | "in_review" | "closed";
          notes?: string;
        };

        if (!project_id || !status) {
          return NextResponse.json(
            { error: "project_id and status are required" },
            { status: 400 }
          );
        }

        const upsertData: Record<string, unknown> = {
          project_id,
          status,
          updated_at: new Date().toISOString(),
        };

        if (notes !== undefined) {
          upsertData.notes = notes;
        }

        if (status === "closed") {
          upsertData.closed_at = new Date().toISOString();
          upsertData.closed_by = user.id;
        } else {
          // Changing away from closed - clear closure fields
          upsertData.closed_at = null;
          upsertData.closed_by = null;
        }

        const { data: updated, error } = await admin
          .from("project_calculation_status")
          .upsert(upsertData, { onConflict: "project_id" })
          .select()
          .single();

        if (error) {
          console.error("[CalcStatus API] update error:", error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data: updated });
      }

      case "list_open": {
        // Fetch explicit rows that are not closed
        const { data: explicitRows, error: explicitError } = await admin
          .from("project_calculation_status")
          .select("*, project:projects(id, name, slug)")
          .neq("status", "closed")
          .order("created_at", { ascending: true });

        if (explicitError) {
          console.error("[CalcStatus API] list_open explicit error:", explicitError);
          return NextResponse.json(
            { error: explicitError.message },
            { status: 500 }
          );
        }

        // Collect project_ids that already have an explicit entry
        const explicitProjectIds = (explicitRows ?? []).map(
          (r: { project_id: string }) => r.project_id
        );

        // Get project_ids from project_costs not already tracked
        const { data: costProjects, error: costError } = await admin
          .from("project_costs")
          .select("project_id");

        if (costError) {
          console.error("[CalcStatus API] list_open cost projects error:", costError);
          return NextResponse.json(
            { error: costError.message },
            { status: 500 }
          );
        }

        // Get project_ids from material_movements not already tracked
        const { data: movementProjects, error: movementError } = await admin
          .from("material_movements")
          .select("project_id");

        if (movementError) {
          console.error(
            "[CalcStatus API] list_open movement projects error:",
            movementError
          );
          return NextResponse.json(
            { error: movementError.message },
            { status: 500 }
          );
        }

        // Collect all project_ids that have costs or movements but no explicit status entry
        const allActivityIds = new Set<string>([
          ...((costProjects ?? []).map((r: { project_id: string }) => r.project_id)),
          ...((movementProjects ?? []).map((r: { project_id: string }) => r.project_id)),
        ]);

        // Also exclude projects that have a "closed" entry in project_calculation_status
        const { data: closedRows, error: closedError } = await admin
          .from("project_calculation_status")
          .select("project_id")
          .eq("status", "closed");

        if (closedError) {
          console.error("[CalcStatus API] list_open closed check error:", closedError);
          return NextResponse.json(
            { error: closedError.message },
            { status: 500 }
          );
        }

        const closedProjectIds = new Set(
          (closedRows ?? []).map((r: { project_id: string }) => r.project_id)
        );

        // All project_ids that appear in explicit entries (any status)
        const { data: allExplicit, error: allExplicitError } = await admin
          .from("project_calculation_status")
          .select("project_id");

        if (allExplicitError) {
          console.error(
            "[CalcStatus API] list_open all explicit check error:",
            allExplicitError
          );
          return NextResponse.json(
            { error: allExplicitError.message },
            { status: 500 }
          );
        }

        const allExplicitProjectIds = new Set(
          (allExplicit ?? []).map((r: { project_id: string }) => r.project_id)
        );

        // Implicit open: has activity, no explicit entry, and not closed
        let implicitOpenCount = 0;
        for (const pid of allActivityIds) {
          if (!allExplicitProjectIds.has(pid) && !closedProjectIds.has(pid)) {
            implicitOpenCount++;
          }
        }

        return NextResponse.json({
          data: {
            explicit: explicitRows ?? [],
            implicit_open_count: implicitOpenCount,
          },
        });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error(`[CalcStatus API] Error:`, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
