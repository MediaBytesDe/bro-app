import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  console.log("=== UPLOAD API CALLED ===");
  console.log("Service key exists:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  try {
    const supabase = createAdminClient();
    console.log("Admin client created");
    
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const projectId = formData.get("projectId") as string;
    const customerId = formData.get("customerId") as string;
    const docName = formData.get("name") as string;
    const docType = formData.get("type") as string;

    if (!file) {
      return NextResponse.json({ error: "Keine Datei" }, { status: 400 });
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
      console.error("Upload error:", JSON.stringify(uploadError, null, 2));
      console.error("Upload details:", { fileName, fileType: file.type, fileSize: file.size });
      return NextResponse.json({ error: uploadError.message, details: uploadError }, { status: 500 });
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
        storage_url: urlData?.publicUrl,
        file_name: file.name,
        file_extension: file.name.split('.').pop() || null,
        file_size: file.size,
        mime_type: file.type,
      })
      .select()
      .single();

    if (dbError) {
      console.error("DB error:", dbError);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, document: doc });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload fehlgeschlagen" },
      { status: 500 }
    );
  }
}
