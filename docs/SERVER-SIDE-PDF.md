# Server-Side PDF Generation

This document explains how PDF generation has been moved to the server-side to improve performance and reduce client bundle size.

## Overview

**Problem:** Client-side PDF generation using jsPDF:
- Increases client bundle size (~500KB for jsPDF library)
- Blocks the UI during PDF generation
- Uses client resources for computation

**Solution:** Server-side PDF generation via API route:
- PDF generation happens on the server
- Client only downloads the finished PDF
- Reduces client bundle size
- Prevents UI blocking
- Better for mobile devices and slow connections

## Architecture

### Server-Side (API Route)

**File:** `src/app/api/pdf/quote/route.ts`

The server-side API route:
1. Authenticates the user
2. Fetches quote data from Supabase
3. Generates PDF using jsPDF (on the server)
4. Returns the PDF as a binary response

```typescript
// POST /api/pdf/quote
{
  "quoteId": "uuid-here"
}

// Returns: PDF binary with correct headers
```

### Client-Side (Utilities)

**File:** `src/lib/pdf/client-utils.ts`

Client-side utilities for consuming the API:

```typescript
import { downloadQuotePDF, openQuotePDF, getQuotePDFBlob } from '@/lib/pdf/client-utils';

// Download PDF
await downloadQuotePDF(quoteId, quoteNumber);

// Open PDF in new tab
await openQuotePDF(quoteId);

// Get PDF blob for further processing
const blob = await getQuotePDFBlob(quoteId);
```

## Usage Examples

### Example 1: Download PDF Button

```tsx
"use client";

import { useState } from 'react';
import { downloadQuotePDF } from '@/lib/pdf/client-utils';
import { Download } from 'lucide-react';

export function DownloadQuoteButton({ quoteId, quoteNumber }: Props) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadQuotePDF(quoteId, quoteNumber);
      // Optional: Show success toast
    } catch (error) {
      console.error('Download failed:', error);
      // Optional: Show error toast
    } finally {
      setDownloading(false);
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg"
    >
      <Download className="w-4 h-4" />
      {downloading ? 'Erstelle PDF...' : 'PDF herunterladen'}
    </button>
  );
}
```

### Example 2: View PDF in New Tab

```tsx
"use client";

import { useState } from 'react';
import { openQuotePDF } from '@/lib/pdf/client-utils';
import { FileText } from 'lucide-react';

export function ViewQuoteButton({ quoteId }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleView() {
    setLoading(true);
    try {
      await openQuotePDF(quoteId);
    } catch (error) {
      console.error('Failed to open PDF:', error);
      // Show error message
    } finally {
      setLoading(false);
    }
  }

  return (
    <button onClick={handleView} disabled={loading}>
      <FileText className="w-4 h-4" />
      {loading ? 'Öffne...' : 'PDF anzeigen'}
    </button>
  );
}
```

### Example 3: Upload PDF to Storage

```tsx
import { getQuotePDFBlob } from '@/lib/pdf/client-utils';
import { createClient } from '@/lib/supabase/client';

async function uploadQuotePDFToStorage(quoteId: string, quoteNumber: string) {
  // Get PDF blob from server
  const blob = await getQuotePDFBlob(quoteId);

  // Upload to Supabase Storage
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from('quotes')
    .upload(`${quoteNumber}.pdf`, blob, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (error) throw error;
  return data;
}
```

## Migration Guide

### Before (Client-Side)

```tsx
// ❌ OLD: Client-side PDF generation
import { generateQuotePDF } from '@/lib/pdf/quote-pdf';

function MyComponent() {
  async function handleDownload() {
    const pdf = generateQuotePDF({ quote, customer });
    pdf.save(`angebot-${quote.quote_number}.pdf`);
  }

  return <button onClick={handleDownload}>Download PDF</button>;
}
```

### After (Server-Side)

```tsx
// ✅ NEW: Server-side PDF generation
import { downloadQuotePDF } from '@/lib/pdf/client-utils';

function MyComponent() {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadQuotePDF(quote.id, quote.quote_number);
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <button onClick={handleDownload} disabled={downloading}>
      {downloading ? 'Erstelle...' : 'Download PDF'}
    </button>
  );
}
```

## Benefits

### Performance Improvements

1. **Reduced Bundle Size**
   - Before: jsPDF (~500KB) loaded on every page
   - After: jsPDF only loaded on server, not in client bundle
   - Savings: ~500KB reduction in client JavaScript

2. **Non-Blocking UI**
   - Before: UI freezes during PDF generation (especially on mobile)
   - After: PDF generation happens on server, UI remains responsive

3. **Better Mobile Experience**
   - Less JavaScript to download and parse
   - Less computation on mobile devices
   - Faster page loads

### Developer Benefits

1. **Cleaner Code**
   - Utilities provide consistent API for PDF operations
   - Error handling built-in
   - Type-safe interfaces

2. **Scalability**
   - Server can be scaled independently
   - Can add caching for frequently generated PDFs
   - Can optimize server resources for PDF generation

## API Reference

### POST /api/pdf/quote

Generates a PDF for a quote.

**Request:**
```json
{
  "quoteId": "uuid"
}
```

**Response:**
- Success: PDF binary (application/pdf)
- Error 401: Unauthorized
- Error 400: Missing quoteId
- Error 404: Quote not found
- Error 500: PDF generation failed

**Headers:**
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="angebot-{quote_number}.pdf"
Cache-Control: private, no-cache
```

## Testing

### Manual Testing

1. **Test API endpoint:**
   ```bash
   curl -X POST http://localhost:3000/api/pdf/quote \
     -H "Content-Type: application/json" \
     -d '{"quoteId":"your-quote-id"}' \
     --output test.pdf
   ```

2. **Test in browser:**
   - Create a quote in the app
   - Add a download button that calls `downloadQuotePDF()`
   - Verify PDF downloads correctly
   - Check browser Network tab for PDF size

### Build Testing

```bash
npm run build
```

Verify:
- Build succeeds without errors
- jsPDF works in Node.js environment
- API route is generated correctly

## Future Enhancements

Potential improvements:

1. **PDF Caching**
   - Cache generated PDFs on server
   - Invalidate cache when quote is updated
   - Serve cached PDFs for faster response

2. **Background Processing**
   - Queue PDF generation for large documents
   - Notify user when PDF is ready
   - Store PDFs in Supabase Storage

3. **PDF Templates**
   - Support multiple PDF templates
   - Allow customization via admin panel
   - Template versioning

4. **Batch PDF Generation**
   - Generate multiple PDFs at once
   - Create ZIP archives of PDFs
   - Bulk email PDFs to customers

## Troubleshooting

### Issue: jsPDF not working on server

**Symptom:** Build fails or PDF generation errors

**Solution:** jsPDF v4.1.0 works fine in Next.js server environment. If you encounter issues:
1. Ensure jsPDF is installed: `npm install jspdf@^4.1.0`
2. Check Node.js version (should be 18+)
3. Verify no browser-only APIs are used in PDF generation code

### Issue: PDF downloads as blob URL

**Symptom:** PDF opens with `blob:http://localhost...` URL

**Solution:** This is expected behavior for `openQuotePDF()`. The blob URL is temporary and cleaned up after use.

### Issue: Large PDFs timeout

**Symptom:** Request timeout for large PDFs

**Solution:** Increase Next.js API route timeout:
```typescript
export const maxDuration = 60; // 60 seconds
```

## Related Files

- `src/app/api/pdf/quote/route.ts` - Server-side PDF API
- `src/lib/pdf/quote-pdf.ts` - PDF generation logic (used on server)
- `src/lib/pdf/client-utils.ts` - Client-side utilities
- `docs/SERVER-SIDE-PDF.md` - This documentation
