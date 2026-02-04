import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Admin client with service role (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    db: {
      schema: 'public'
    }
  }
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    // Verify the requester is a partner admin
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const { data: partnerUser } = await supabase
      .from("partner_users")
      .select("*, partner:partners(*)")
      .eq("auth_user_id", user.id)
      .single();

    if (!partnerUser || partnerUser.role !== "admin") {
      return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
    }

    // For admin: allow specifying partnerId directly
    const isInternalAdmin = partnerUser.role === 'admin' || user.user_metadata?.role === 'admin';
    const partnerId = data.partnerId || partnerUser.partner_id;

    // Verify access to this partner
    if (data.partnerId && data.partnerId !== partnerUser.partner_id) {
      // Check if user is internal admin (from users table)
      const { data: internalUser } = await supabase
        .from("users")
        .select("role")
        .eq("auth_id", user.id)
        .single();
      
      if (!internalUser || !['admin', 'mitarbeiter'].includes(internalUser.role)) {
        return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
      }
    }

    switch (action) {
      case "create": {
        const { name, email, phone, role, password } = data;

        if (!name || !email || !password) {
          return NextResponse.json({ error: "Name, E-Mail und Passwort sind erforderlich" }, { status: 400 });
        }

        if (password.length < 12) {
          return NextResponse.json({ error: "Passwort muss mindestens 12 Zeichen haben" }, { status: 400 });
        }

        // Password complexity check
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumbers = /\d/.test(password);

        if (!(hasUpperCase && hasLowerCase && hasNumbers)) {
          return NextResponse.json({ 
            error: "Passwort muss Groß-, Kleinbuchstaben und Zahlen enthalten" 
          }, { status: 400 });
        }

        // Check if email already exists in this partner
        const { data: existing } = await supabaseAdmin
          .from("partner_users")
          .select("id")
          .eq("partner_id", partnerId)
          .eq("email", email)
          .single();

        if (existing) {
          return NextResponse.json({ error: "Diese E-Mail existiert bereits" }, { status: 400 });
        }

        // Create auth user with admin API
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true, // Auto-confirm email
          user_metadata: {
            display_name: name,
            role: "subcontractor",
          },
        });

        if (authError) {
          if (authError.message.includes("already been registered")) {
            return NextResponse.json({ error: "Diese E-Mail ist bereits registriert" }, { status: 400 });
          }
          return NextResponse.json({ error: "Fehler beim Erstellen des Benutzers" }, { status: 500 });
        }

        // Create entry in users table (for auth/middleware)
        const { error: usersError } = await supabaseAdmin
          .from("users")
          .insert({
            auth_id: authUser.user.id,
            username: email.split("@")[0] + "_" + Date.now(),
            display_name: name,
            email,
            role: "subcontractor",
            active: true,
          });

        if (usersError) {
          // Rollback: delete auth user
          await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
          return NextResponse.json({ error: "Fehler beim Erstellen des Profils" }, { status: 500 });
        }

        // Create partner_user entry
        const { data: newUser, error: dbError } = await supabaseAdmin
          .from("partner_users")
          .insert({
            partner_id: partnerId,
            auth_user_id: authUser.user.id,
            display_name: name,
            email,
            phone: phone || null,
            role: role || "worker",
            active: true,
            joined_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (dbError) {
          // Rollback: delete auth user and users entry
          await supabaseAdmin.from("users").delete().eq("auth_id", authUser.user.id);
          await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
          return NextResponse.json({ error: "Fehler beim Speichern" }, { status: 500 });
        }

        return NextResponse.json({ success: true, user: newUser });
      }

      case "update": {
        const { userId, name, phone, role, active, password } = data;

        if (!userId) {
          return NextResponse.json({ error: "User ID fehlt" }, { status: 400 });
        }

        // Verify user belongs to this partner
        const { data: targetUser } = await supabaseAdmin
          .from("partner_users")
          .select("*")
          .eq("id", userId)
          .eq("partner_id", partnerId)
          .single();

        if (!targetUser) {
          return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
        }

        // Can't change own role or deactivate self
        if (targetUser.auth_user_id === user.id) {
          if (role && role !== targetUser.role) {
            return NextResponse.json({ error: "Sie können Ihre eigene Rolle nicht ändern" }, { status: 400 });
          }
          if (active === false) {
            return NextResponse.json({ error: "Sie können sich nicht selbst deaktivieren" }, { status: 400 });
          }
        }

        // Update partner_users
        const updateData: any = {};
        if (name !== undefined) updateData.display_name = name;
        if (phone !== undefined) updateData.phone = phone;
        if (role !== undefined) updateData.role = role;
        if (active !== undefined) updateData.active = active;

        const { error: updateError } = await supabaseAdmin
          .from("partner_users")
          .update(updateData)
          .eq("id", userId);

        if (updateError) {
          return NextResponse.json({ error: "Fehler beim Aktualisieren" }, { status: 500 });
        }

        // Update password if provided
        if (password && password.length >= 6 && targetUser.auth_user_id) {
          const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(
            targetUser.auth_user_id,
            { password }
          );
          if (pwError) {
            return NextResponse.json({ error: "Passwort konnte nicht geändert werden" }, { status: 500 });
          }
        }

        return NextResponse.json({ success: true });
      }

      case "delete": {
        const { userId } = data;

        if (!userId) {
          return NextResponse.json({ error: "User ID fehlt" }, { status: 400 });
        }

        // Verify user belongs to this partner (or admin has access)
        const { data: targetUser } = await supabaseAdmin
          .from("partner_users")
          .select("*")
          .eq("id", userId)
          .single();
        
        // Check if partner matches or admin has general access
        if (targetUser && targetUser.partner_id !== partnerId && !data.partnerId) {
          return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
        }

        if (!targetUser) {
          return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
        }

        // Can't delete self
        if (targetUser.auth_user_id === user.id) {
          return NextResponse.json({ error: "Sie können sich nicht selbst löschen" }, { status: 400 });
        }

        // Delete partner_user first
        await supabaseAdmin
          .from("partner_users")
          .delete()
          .eq("id", userId);

        // Delete users table entry and auth user
        if (targetUser.auth_user_id) {
          await supabaseAdmin
            .from("users")
            .delete()
            .eq("auth_id", targetUser.auth_user_id);
          
          await supabaseAdmin.auth.admin.deleteUser(targetUser.auth_user_id);
        }

        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: "Unbekannte Aktion" }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server-Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
