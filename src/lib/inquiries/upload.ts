import { createClient } from "@/lib/supabase/client";

/**
 * Upload a single photo for an inquiry to Supabase Storage.
 * Returns the public URL of the uploaded file.
 */
export async function uploadInquiryPhoto(
  file: File,
  inquiryId: string
): Promise<string> {
  const supabase = createClient();
  const ext = file.name.split(".").pop() || "jpg";
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const path = `inquiry-photos/${inquiryId}/${fileName}`;

  const { error } = await supabase.storage
    .from("documents")
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) throw new Error(`Upload fehlgeschlagen: ${error.message}`);

  const { data: urlData } = supabase.storage
    .from("documents")
    .getPublicUrl(path);

  return urlData.publicUrl;
}

/**
 * Upload multiple photos for an inquiry sequentially.
 * Returns an array of public URLs.
 */
export async function uploadMultiplePhotos(
  files: File[],
  inquiryId: string
): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files) {
    const url = await uploadInquiryPhoto(file, inquiryId);
    urls.push(url);
  }
  return urls;
}

/**
 * Delete an inquiry photo from Supabase Storage by its public URL.
 */
export async function deleteInquiryPhoto(photoUrl: string): Promise<void> {
  const supabase = createClient();

  // Extract storage path from public URL
  const urlObj = new URL(photoUrl);
  const pathMatch = urlObj.pathname.match(
    /\/storage\/v1\/object\/public\/documents\/(.*)/
  );
  if (!pathMatch) return;

  const { error } = await supabase.storage
    .from("documents")
    .remove([pathMatch[1]]);

  if (error) throw new Error(`Löschen fehlgeschlagen: ${error.message}`);
}
