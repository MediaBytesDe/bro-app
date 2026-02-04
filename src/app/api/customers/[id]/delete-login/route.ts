import { createClient } from "@supabase/supabase-js";
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
      console.error("Auth delete error:", authError);
      return NextResponse.json(
        { error: authError.message },
        { status: 500 }
      );
    }

    // Clear auth_user_id from customer
    const { error: updateError } = await supabase
      .from("customers")
      .update({ auth_user_id: null })
      .eq("id", customerId);

    if (updateError) {
      console.error("Update error:", updateError);
    }

    return NextResponse.json({
      success: true,
      message: `Login für ${customer.email} gelöscht`,
    });

  } catch (error: any) {
    console.error("Delete login error:", error);
    return NextResponse.json(
      { error: error.message || "Fehler beim Löschen des Logins" },
      { status: 500 }
    );
  }
}
