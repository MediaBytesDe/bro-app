/**
 * Convert an absolute Supabase Storage URL to a relative path.
 * This way images are served through our own domain via Next.js rewrite.
 * 
 * Input:  https://xyz.supabase.co/storage/v1/object/public/documents/logos/foo.png
 * Output: /storage/v1/object/public/documents/logos/foo.png
 */
export function toRelativeStorageUrl(url: string): string {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (u.hostname.endsWith('.supabase.co') || u.hostname === 'db.brojekt.dev') {
      return u.pathname;
    }
  } catch {
    // Already relative or invalid — return as-is
  }
  return url;
}
