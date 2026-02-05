/**
 * Client-side utilities for downloading PDFs from server-side API
 *
 * This replaces direct client-side PDF generation to:
 * - Reduce client bundle size
 * - Prevent UI blocking during PDF generation
 * - Improve performance
 */

/**
 * Downloads a quote PDF from the server-side API
 *
 * @example
 * ```tsx
 * async function handleDownloadPDF() {
 *   setLoading(true);
 *   try {
 *     await downloadQuotePDF(quote.id, quote.quote_number);
 *     toast.success('PDF downloaded');
 *   } catch (error) {
 *     toast.error('Failed to download PDF');
 *   } finally {
 *     setLoading(false);
 *   }
 * }
 * ```
 */
export async function downloadQuotePDF(
  quoteId: string,
  quoteNumber?: string
): Promise<void> {
  try {
    const response = await fetch('/api/pdf/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quoteId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'PDF generation failed');
    }

    // Get PDF blob
    const blob = await response.blob();

    // Create download link
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `angebot-${quoteNumber || quoteId}.pdf`;

    // Trigger download
    document.body.appendChild(a);
    a.click();

    // Cleanup
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('[Download PDF Error]', error);
    throw error;
  }
}

/**
 * Opens a quote PDF in a new browser tab
 *
 * @example
 * ```tsx
 * async function handleViewPDF() {
 *   setLoading(true);
 *   try {
 *     await openQuotePDF(quote.id);
 *   } catch (error) {
 *     toast.error('Failed to open PDF');
 *   } finally {
 *     setLoading(false);
 *   }
 * }
 * ```
 */
export async function openQuotePDF(quoteId: string): Promise<void> {
  try {
    const response = await fetch('/api/pdf/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quoteId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'PDF generation failed');
    }

    // Get PDF blob
    const blob = await response.blob();

    // Open in new tab
    const url = window.URL.createObjectURL(blob);
    window.open(url, '_blank');

    // Cleanup after a delay to ensure the new tab loads
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
    }, 1000);
  } catch (error) {
    console.error('[Open PDF Error]', error);
    throw error;
  }
}

/**
 * Gets a quote PDF as a Blob (useful for further processing)
 *
 * @example
 * ```tsx
 * async function handleGetPDFBlob() {
 *   const blob = await getQuotePDFBlob(quote.id);
 *   // Upload to storage, send via email, etc.
 * }
 * ```
 */
export async function getQuotePDFBlob(quoteId: string): Promise<Blob> {
  const response = await fetch('/api/pdf/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quoteId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'PDF generation failed');
  }

  return response.blob();
}
