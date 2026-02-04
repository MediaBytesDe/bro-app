import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// Admin client with service role for auth management
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
    const { password, sendEmail = true } = await request.json();

    const supabase = createAdminClient();

    // Get customer data
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, email, first_name, last_name, company_name, auth_user_id")
      .eq("id", customerId)
      .single();

    if (customerError || !customer) {
      return NextResponse.json(
        { error: "Kunde nicht gefunden" },
        { status: 404 }
      );
    }

    if (!customer.email) {
      return NextResponse.json(
        { error: "Kunde hat keine E-Mail-Adresse" },
        { status: 400 }
      );
    }

    // Check if already has login
    if (customer.auth_user_id) {
      return NextResponse.json(
        { error: "Kunde hat bereits einen Login" },
        { status: 400 }
      );
    }

    // Generate password if not provided
    const userPassword = password || generatePassword();

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: customer.email,
      password: userPassword,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        customer_id: customer.id,
        first_name: customer.first_name,
        last_name: customer.last_name,
        company_name: customer.company_name,
        role: "customer",
      },
    });

    if (authError) {
      console.error("Auth error:", authError);
      return NextResponse.json(
        { error: authError.message },
        { status: 500 }
      );
    }

    // Create user profile for customer
    const displayName = customer.company_name 
      || `${customer.first_name || ""} ${customer.last_name || ""}`.trim() 
      || "Kunde";
    
    const { error: profileError } = await supabase
      .from("users")
      .insert({
        auth_id: authData.user.id,
        username: customer.email,
        display_name: displayName,
        email: customer.email,
        role: "customer",
        active: true,
      });

    if (profileError) {
      // Rollback: delete auth user
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: `Profil-Fehler: ${profileError.message}` },
        { status: 500 }
      );
    }

    // Update customer with auth_user_id
    const { error: updateError } = await supabase
      .from("customers")
      .update({ auth_user_id: authData.user.id })
      .eq("id", customerId);

    if (updateError) {
      // Rollback: delete auth user and profile
      await supabase.from("users").delete().eq("auth_id", authData.user.id);
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      userId: authData.user.id,
      email: customer.email,
      password: userPassword, // Return password so it can be shared with customer
      message: `Login für ${customer.email} erstellt`,
    });

  } catch (error: any) {
    console.error("Create login error:", error);
    return NextResponse.json(
      { error: error.message || "Fehler beim Erstellen des Logins" },
      { status: 500 }
    );
  }
}

// Generate a random password
function generatePassword(length = 12): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}
