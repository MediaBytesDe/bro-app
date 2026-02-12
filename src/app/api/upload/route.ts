import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { isValidUUID } from "@/lib/validation";

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const authSupabase = await createClient();
    const { data: { user } } = await authSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const projectId = formData.get("projectId") as string;
    const customerId = formData.get("customerId") as string;
    const docName = formData.get("name") as string;
    const docType = formData.get("type") as string;

    if (!file) {
      return NextResponse.json({ error: "Keine Datei" }, { status: 400 });
    }

    // SECURITY: File type validation
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Dateityp nicht erlaubt. Erlaubt: JPG, PNG, PDF, Word, Excel" },
        { status: 400 }
      );
    }

    // SECURITY: File size limit (10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Datei zu groß. Maximum: 10MB" },
        { status: 400 }
      );
    }

    // SECURITY: Authorization check - verify user has access to project/customer
    const { data: profile } = await authSupabase
      .from("users")
      .select("role")
      .eq("auth_id", user.id)
      .single();

    const isStaff = profile?.role && ["admin", "mitarbeiter", "superadmin"].includes(profile.role);

    if (!isStaff) {
      // For non-staff users, verify they own the project/customer
      if (projectId) {
        const { data: project } = await authSupabase
          .from("projects")
          .select("customer_id")
          .eq("id", projectId)
          .single();

        const { data: customer } = await authSupabase
          .from("customers")
          .select("id")
          .eq("auth_user_id", user.id)
          .single();

        if (!project || !customer || project.customer_id !== customer.id) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      } else if (customerId) {
        const { data: customer } = await authSupabase
          .from("customers")
          .select("id")
          .eq("auth_user_id", user.id)
          .eq("id", customerId)
          .single();

        if (!customer) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      } else {
        return NextResponse.json(
          { error: "projectId oder customerId erforderlich" },
          { status: 400 }
        );
      }
    }

    // Convert File to Buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Sanitize filename (remove special chars, spaces, umlauts)
    const sanitizedName = file.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
      .replace(/[äÄ]/g, "ae")
      .replace(/[öÖ]/g, "oe")
      .replace(/[üÜ]/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/[^a-zA-Z0-9._-]/g, "_") // Replace other special chars with underscore
      .replace(/_+/g, "_"); // Collapse multiple underscores
    
    // Generate filename
    const fileName = `${projectId}/${Date.now()}-${sanitizedName}`;

    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("documents")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("documents")
      .getPublicUrl(fileName);

    // Create document record
    const { data: doc, error: dbError } = await supabase
      .from("documents")
      .insert({
        project_id: projectId || null,
        customer_id: customerId || null,
        name: docName || file.name,
        document_type: docType || "sonstiges",
        storage_path: fileName,
        storage_url: urlData?.publicUrl ? new URL(urlData.publicUrl).pathname : null,
        file_name: file.name,
        file_extension: file.name.split('.').pop() || null,
        file_size: file.size,
        mime_type: file.type,
      })
      .select()
      .single();

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, document: doc });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload fehlgeschlagen" },
      { status: 500 }
    );
  }
}
