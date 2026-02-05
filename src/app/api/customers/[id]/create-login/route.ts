import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

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
    // Auth check - only admin/mitarbeiter can create customer logins
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

    // Generate cryptographically secure password if not provided
    const userPassword = password || generateSecurePassword();

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

    // SECURITY: Never return password in response
    // TODO: Implement email-based password delivery
    // For now, log securely (only visible in server logs, not response)
    if (!password) {
      console.log(`[SECURITY] Temporary password created for ${customer.email} - Password must be delivered securely to customer`);
    }

    return NextResponse.json({
      success: true,
      userId: authData.user.id,
      email: customer.email,
      message: `Login für ${customer.email} erstellt. ${!password ? 'Passwort wurde generiert und muss dem Kunden sicher übermittelt werden.' : ''}`,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Fehler beim Erstellen des Logins";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

// SECURITY: Cryptographically secure password generation
function generateSecurePassword(length = 16): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  const randomValues = randomBytes(length);
  let password = "";

  for (let i = 0; i < length; i++) {
    password += chars[randomValues[i] % chars.length];
  }

  return password;
}
