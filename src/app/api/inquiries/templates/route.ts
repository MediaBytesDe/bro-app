import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Admin client with service role (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: "public" },
  }
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    // Auth check via server client
    const serverClient = await createServerClient();
    const { data: { user } } = await serverClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    // Role check - only staff can manage templates
    const { data: profile } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("auth_id", user.id)
      .single();

    if (!profile || !["admin", "mitarbeiter", "superadmin"].includes(profile.role)) {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    switch (action) {
      case "list": {
        const { trade, include_inactive } = data;

        let query = supabaseAdmin
          .from("inquiry_templates")
          .select("*")
          .order("sort_order", { ascending: true });

        if (trade) {
          query = query.eq("trade", trade);
        }

        if (!include_inactive) {
          query = query.eq("is_active", true);
        }

        const { data: templates, error } = await query;

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data: templates });
      }

      case "create": {
        const { trade, name, description, fields, sort_order } = data;

        if (!trade || !name) {
          return NextResponse.json(
            { error: "Gewerk und Name sind erforderlich" },
            { status: 400 }
          );
        }

        const insertData: Record<string, unknown> = {
          trade,
          name,
        };

        if (description !== undefined) insertData.description = description;
        if (fields !== undefined) insertData.fields = fields;
        if (sort_order !== undefined) insertData.sort_order = sort_order;

        const { data: template, error } = await supabaseAdmin
          .from("inquiry_templates")
          .insert(insertData)
          .select()
          .single();

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data: template });
      }

      case "update": {
        const { id, name, description, fields, is_active, sort_order, trade } = data;

        if (!id) {
          return NextResponse.json({ error: "ID ist erforderlich" }, { status: 400 });
        }

        const updateData: Record<string, unknown> = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (fields !== undefined) updateData.fields = fields;
        if (is_active !== undefined) updateData.is_active = is_active;
        if (sort_order !== undefined) updateData.sort_order = sort_order;
        if (trade !== undefined) updateData.trade = trade;

        if (Object.keys(updateData).length === 0) {
          return NextResponse.json(
            { error: "Keine Felder zum Aktualisieren" },
            { status: 400 }
          );
        }

        const { data: template, error } = await supabaseAdmin
          .from("inquiry_templates")
          .update(updateData)
          .eq("id", id)
          .select()
          .single();

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data: template });
      }

      case "delete": {
        const { id } = data;

        if (!id) {
          return NextResponse.json({ error: "ID ist erforderlich" }, { status: 400 });
        }

        // Soft delete: set is_active = false
        const { error } = await supabaseAdmin
          .from("inquiry_templates")
          .update({ is_active: false })
          .eq("id", id);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: "Unbekannte Aktion" }, { status: 400 });
    }
  } catch (error) {
    console.error("[API /api/inquiries/templates] Error:", error);
    const message = error instanceof Error ? error.message : "Server-Fehler";
    const stack = error instanceof Error ? error.stack : undefined;
    return NextResponse.json({ error: message, stack, env_check: { service_role_set: !!process.env.SUPABASE_SERVICE_ROLE_KEY, supabase_url_set: !!process.env.NEXT_PUBLIC_SUPABASE_URL } }, { status: 500 });
  }
}
