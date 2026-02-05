import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { uploadDocument, deleteDocument, getDocumentWithUrl } from "@/lib/onedrive/documents";
import type { DocumentType } from "@/types/database";

/**
 * POST /api/documents
 * Upload a new document
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    
    const file = formData.get("file") as File | null;
    const projectId = formData.get("projectId") as string | null;
    const customerId = formData.get("customerId") as string | null;
    const documentType = (formData.get("documentType") as DocumentType) || "sonstiges";
    const description = formData.get("description") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!projectId && !customerId) {
      return NextResponse.json(
        { error: "Either projectId or customerId is required" },
        { status: 400 }
      );
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
    if (file.type && !allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "File type not allowed. Allowed: JPG, PNG, PDF, Word, Excel" },
        { status: 400 }
      );
    }

    // SECURITY: File size limit (10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum: 10MB" },
        { status: 400 }
      );
    }

    // SECURITY: Authorization check - verify user has access to project/customer
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("auth_id", user.id)
      .single();

    const isStaff = profile?.role && ["admin", "mitarbeiter", "superadmin"].includes(profile.role);

    if (!isStaff) {
      // For non-staff users, verify they own the project/customer
      if (projectId) {
        const { data: project } = await supabase
          .from("projects")
          .select("customer_id")
          .eq("id", projectId)
          .single();

        const { data: customer } = await supabase
          .from("customers")
          .select("id")
          .eq("auth_user_id", user.id)
          .single();

        if (!project || !customer || project.customer_id !== customer.id) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      } else if (customerId) {
        const { data: customer } = await supabase
          .from("customers")
          .select("id")
          .eq("auth_user_id", user.id)
          .eq("id", customerId)
          .single();

        if (!customer) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const document = await uploadDocument({
      projectId: projectId || undefined,
      customerId: customerId || undefined,
      fileName: file.name,
      content: buffer,
      contentType: file.type || "application/octet-stream",
      documentType,
      description: description || undefined,
      uploadedBy: user.id,
    });

    return NextResponse.json({ success: true, document });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/documents?id=xxx
 * Get document with download URL
 * SECURITY: Ownership check - users can only access their own documents
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get("id");

  if (!documentId) {
    return NextResponse.json({ error: "Document ID required" }, { status: 400 });
  }

  try {
    // Get user profile for role check
    const { data: userProfile } = await supabase
      .from("users")
      .select("role, id")
      .eq("auth_id", user.id)
      .single();

    const isStaff = userProfile?.role && ["admin", "mitarbeiter", "superadmin"].includes(userProfile.role);

    // Get document with project info for ownership check
    const { data: docRecord, error: docError } = await supabase
      .from("documents")
      .select(`
        id,
        project_id,
        customer_id,
        visible_to_customer,
        projects!left(customer_id)
      `)
      .eq("id", documentId)
      .single();

    if (docError || !docRecord) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Staff can access any document
    if (!isStaff) {
      // For customers: check ownership
      const { data: customerProfile } = await supabase
        .from("customers")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();

      if (!customerProfile) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      // Check if document belongs to customer's project
      // projects is an array from the left join, take first element
      const projectData = Array.isArray(docRecord.projects) 
        ? docRecord.projects[0] 
        : docRecord.projects;
      const projectCustomerId = (projectData as { customer_id: string } | null)?.customer_id;
      const isOwner = 
        docRecord.customer_id === customerProfile.id || 
        projectCustomerId === customerProfile.id;

      // Customers can only see their own documents that are marked visible
      if (!isOwner || !docRecord.visible_to_customer) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Fetch the full document with URL
    const document = await getDocumentWithUrl(documentId);
    
    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    return NextResponse.json({ document });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Fetch failed" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/documents?id=xxx
 * Delete a document
 */
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check role
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("auth_id", user.id)
    .single();

  if (!profile || !["admin", "mitarbeiter"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get("id");

  if (!documentId) {
    return NextResponse.json({ error: "Document ID required" }, { status: 400 });
  }

  try {
    await deleteDocument(documentId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 }
    );
  }
}
