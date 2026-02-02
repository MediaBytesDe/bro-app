/**
 * Document Service
 * 
 * Manages documents with OneDrive storage and Supabase metadata.
 */

import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { getOneDriveClient } from "./client";
import type { Document, DocumentType } from "@/types/database";

export interface UploadDocumentParams {
  projectId?: string;
  customerId?: string;
  fileName: string;
  content: Buffer;
  contentType: string;
  documentType: DocumentType;
  description?: string;
  uploadedBy: string;
}

export interface DocumentWithUrl extends Document {
  downloadUrl?: string;
}

/**
 * Upload a document
 */
export async function uploadDocument(params: UploadDocumentParams): Promise<Document> {
  const supabase = await createSupabaseClient();
  const onedrive = getOneDriveClient();

  // Determine folder based on project or customer
  let folderId: string;
  let folderPath: string;

  if (params.projectId) {
    // Get project info
    const { data: project } = await supabase
      .from("projects")
      .select("slug, name")
      .eq("id", params.projectId)
      .single();

    if (!project) {
      throw new Error("Project not found");
    }

    // Create or get project folder
    folderId = await onedrive.createProjectFolder(project.slug);
    folderPath = `/BROjekt/Projekte/${project.slug}`;
  } else if (params.customerId) {
    // Get customer info
    const { data: customer } = await supabase
      .from("customers")
      .select("id, company_name, first_name, last_name")
      .eq("id", params.customerId)
      .single();

    if (!customer) {
      throw new Error("Customer not found");
    }

    const customerName = customer.company_name || 
      `${customer.first_name || ""} ${customer.last_name}`.trim();

    // Get or create customer folder
    const customerFolder = await onedrive.getFolderByPath(`/BROjekt/Kunden/${customerName}`);
    
    if (customerFolder) {
      folderId = customerFolder.id;
    } else {
      // Ensure folder structure exists
      await onedrive.ensureFolderStructure();
      const kundenFolder = await onedrive.getFolderByPath("/BROjekt/Kunden");
      if (!kundenFolder) throw new Error("Could not create Kunden folder");
      
      const newFolder = await onedrive["createFolderIfNotExists"](
        await onedrive["getDriveId"](),
        kundenFolder.id,
        customerName
      );
      folderId = newFolder?.id || kundenFolder.id;
    }
    folderPath = `/BROjekt/Kunden/${customerName}`;
  } else {
    throw new Error("Either projectId or customerId is required");
  }

  // Upload to OneDrive
  const uploadResult = params.content.length > 4 * 1024 * 1024
    ? await onedrive.uploadLargeFile(folderId, params.fileName, params.content)
    : await onedrive.uploadFile(folderId, params.fileName, params.content, params.contentType);

  // Save metadata to Supabase
  const { data: document, error } = await supabase
    .from("documents")
    .insert({
      project_id: params.projectId || null,
      customer_id: params.customerId || null,
      name: params.fileName,
      description: params.description || null,
      document_type: params.documentType,
      mime_type: params.contentType,
      size_bytes: uploadResult.size,
      onedrive_id: uploadResult.id,
      onedrive_url: uploadResult.webUrl,
      onedrive_path: `${folderPath}/${params.fileName}`,
      uploaded_by: params.uploadedBy,
    })
    .select()
    .single();

  if (error) {
    // Try to delete from OneDrive if DB insert fails
    try {
      await onedrive.deleteItem(uploadResult.id);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }

  return document;
}

/**
 * Get document with download URL
 */
export async function getDocumentWithUrl(documentId: string): Promise<DocumentWithUrl | null> {
  const supabase = await createSupabaseClient();
  const onedrive = getOneDriveClient();

  const { data: document, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .single();

  if (error || !document) {
    return null;
  }

  // Get sharing link for download
  if (document.onedrive_id) {
    try {
      const link = await onedrive.createSharingLink(document.onedrive_id, "view", 1);
      return { ...document, downloadUrl: link.webUrl };
    } catch {
      // Return without download URL if sharing fails
      return document;
    }
  }

  return document;
}

/**
 * List documents for a project
 */
export async function listProjectDocuments(projectId: string): Promise<Document[]> {
  const supabase = await createSupabaseClient();

  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * List documents for a customer
 */
export async function listCustomerDocuments(customerId: string): Promise<Document[]> {
  const supabase = await createSupabaseClient();

  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Delete a document
 */
export async function deleteDocument(documentId: string): Promise<void> {
  const supabase = await createSupabaseClient();
  const onedrive = getOneDriveClient();

  // Get document
  const { data: document } = await supabase
    .from("documents")
    .select("onedrive_id")
    .eq("id", documentId)
    .single();

  if (!document) {
    throw new Error("Document not found");
  }

  // Delete from OneDrive
  if (document.onedrive_id) {
    try {
      await onedrive.deleteItem(document.onedrive_id);
    } catch (err) {
      console.error("OneDrive delete failed:", err);
      // Continue to delete from DB even if OneDrive fails
    }
  }

  // Delete from DB
  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId);

  if (error) throw error;
}

/**
 * Sync OneDrive folder with database
 */
export async function syncProjectFolder(projectId: string): Promise<{
  added: number;
  removed: number;
  errors: string[];
}> {
  const supabase = await createSupabaseClient();
  const onedrive = getOneDriveClient();

  const stats = { added: 0, removed: 0, errors: [] as string[] };

  // Get project
  const { data: project } = await supabase
    .from("projects")
    .select("slug, onedrive_folder_id")
    .eq("id", projectId)
    .single();

  if (!project?.onedrive_folder_id) {
    return stats;
  }

  try {
    // List files in OneDrive
    const onedriveFiles = await onedrive.listFiles(project.onedrive_folder_id);
    
    // Get existing documents from DB
    const { data: dbDocuments } = await supabase
      .from("documents")
      .select("id, onedrive_id")
      .eq("project_id", projectId);

    const dbOnedriveIds = new Set(dbDocuments?.map(d => d.onedrive_id) || []);
    const onedriveIds = new Set(onedriveFiles.map(f => f.id));

    // Add new files to DB
    for (const file of onedriveFiles) {
      if (!file.file || dbOnedriveIds.has(file.id)) continue;

      try {
        await supabase.from("documents").insert({
          project_id: projectId,
          name: file.name,
          document_type: "sonstiges",
          mime_type: file.file.mimeType,
          size_bytes: file.size || 0,
          onedrive_id: file.id,
          onedrive_url: file.webUrl || null,
        });
        stats.added++;
      } catch (err) {
        stats.errors.push(`Add ${file.name}: ${err instanceof Error ? err.message : "Unknown"}`);
      }
    }

    // Mark removed files
    for (const doc of dbDocuments || []) {
      if (doc.onedrive_id && !onedriveIds.has(doc.onedrive_id)) {
        await supabase
          .from("documents")
          .update({ onedrive_id: null, onedrive_url: null })
          .eq("id", doc.id);
        stats.removed++;
      }
    }
  } catch (err) {
    stats.errors.push(`Sync failed: ${err instanceof Error ? err.message : "Unknown"}`);
  }

  return stats;
}
