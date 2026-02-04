import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth check - only admin/mitarbeiter can delete customer logins
    const authSupabase = await createServerClient();
    const { data: { user } } = await authSupabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await authSupabase
      .from("users")
      .select("role")
      .eq("auth_id", user.id)
      .single();

    if (!profile || !["admin", "mitarbeiter", "superadmin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: customerId } = await params;
    const supabase = createAdminClient();

    // Get customer with auth_user_id
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, auth_user_id, email")
      .eq("id", customerId)
      .single();

    if (customerError || !customer) {
      return NextResponse.json(
        { error: "Kunde nicht gefunden" },
        { status: 404 }
      );
    }

    if (!customer.auth_user_id) {
      return NextResponse.json(
        { error: "Kunde hat keinen Login" },
        { status: 400 }
      );
    }

    // Delete user profile first
    await supabase
      .from("users")
      .delete()
      .eq("auth_id", customer.auth_user_id);

    // Delete auth user
    const { error: authError } = await supabase.auth.admin.deleteUser(
      customer.auth_user_id
    );

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 500 }
      );
    }

    // Clear auth_user_id from customer
    await supabase
      .from("customers")
      .update({ auth_user_id: null })
      .eq("id", customerId);

    return NextResponse.json({
      success: true,
      message: `Login für ${customer.email} gelöscht`,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Fehler beim Löschen des Logins";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
