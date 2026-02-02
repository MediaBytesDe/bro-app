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
    console.error("Document upload error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/documents?id=xxx
 * Get document with download URL
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
    const document = await getDocumentWithUrl(documentId);
    
    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    return NextResponse.json({ document });
  } catch (err) {
    console.error("Document fetch error:", err);
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
    console.error("Document delete error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Delete failed" },
      { status: 500 }
    );
  }
}
