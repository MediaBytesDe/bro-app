/**
 * Quote PDF Generator — BROjekt GmbH Professional Layout
 * 
 * Generates branded PDF documents for quotes using jsPDF.
 * Features: Logo, brand colors, AGB, footer, page numbers.
 */

import { jsPDF } from "jspdf";
import type { QuoteLineItem, Customer } from "@/types/database";

// Extended quote type for PDF generation (supports fields from both Quote table and wawi_quotes mapping)
interface QuotePDFQuote {
  quote_number?: string | null;
  title?: string | null;
  created_at?: string | null;
  valid_until?: string | null;
  line_items?: QuoteLineItem[] | null;
  introduction?: string | null;
  payment_terms?: string | null;
  total_net?: number | null;
  total_tax?: number | null;
  total_gross?: number | null;
  tax_rate?: number | null;
  // Standard Quote fields as fallback
  net_amount?: number | null;
  tax_amount?: number | null;
  gross_amount?: number | null;
}

interface QuotePDFData {
  quote: QuotePDFQuote;
  customer: Customer | null;
  companyInfo?: CompanyInfo;
  logoBase64?: string;
}

interface CompanyInfo {
  name: string;
  street: string;
  zip: string;
  city: string;
  phone: string;
  email: string;
  website: string;
  taxId: string;
  bankName: string;
  iban: string;
  bic: string;
  ceo: string;
  court: string;
  hrb: string;
}

const DEFAULT_COMPANY: CompanyInfo = {
  name: "BROjekt GmbH",
  street: "Musterstraße 1",
  zip: "26427",
  city: "Esens",
  phone: "04971 / 923 50 50",
  email: "info@brojekt.gmbh",
  website: "www.brojekt.gmbh",
  taxId: "DE123456789",
  bankName: "Volksbank",
  iban: "DE89 3704 0044 0532 0130 00",
  bic: "COBADEFFXXX",
  ceo: "André Freese",
  court: "Amtsgericht Aurich",
  hrb: "HRB XXXXX",
};

// BROjekt Brand Colors
const BRAND = {
  primary: [250, 67, 42] as [number, number, number],    // #fa432a
  primaryDark: [200, 50, 30] as [number, number, number],
  dark: [30, 30, 30] as [number, number, number],
  text: [40, 40, 40] as [number, number, number],
  gray: [120, 120, 120] as [number, number, number],
  lightGray: [180, 180, 180] as [number, number, number],
  tableHeader: [245, 245, 245] as [number, number, number],
  tableAlt: [252, 252, 252] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

const PAGE = {
  marginLeft: 20,
  marginRight: 20,
  marginTop: 20,
  marginBottom: 30,
  width: 210,
  contentWidth: 170,
  footerY: 272,
};

export function generateQuotePDF(data: QuotePDFData): jsPDF {
  const { quote, customer, companyInfo = DEFAULT_COMPANY, logoBase64 } = data;
  const doc = new jsPDF();
  const lineItems = (quote.line_items as QuoteLineItem[]) || [];
  let y = PAGE.marginTop;
  let pageNum = 1;

  // ─── Helper Functions ───────────────────────────────────
  function addPageFooter() {
    const fy = PAGE.footerY;
    
    // Separator line
    doc.setDrawColor(...BRAND.lightGray);
    doc.setLineWidth(0.3);
    doc.line(PAGE.marginLeft, fy - 4, PAGE.width - PAGE.marginRight, fy - 4);

    doc.setFontSize(7);
    doc.setTextColor(...BRAND.gray);
    doc.setFont("helvetica", "normal");

    // 3-column footer
    // Left: Company + Legal
    doc.text(companyInfo.name, PAGE.marginLeft, fy);
    doc.text(`${companyInfo.street}, ${companyInfo.zip} ${companyInfo.city}`, PAGE.marginLeft, fy + 3.5);
    doc.text(`GF: ${companyInfo.ceo} · ${companyInfo.court} · ${companyInfo.hrb}`, PAGE.marginLeft, fy + 7);

    // Center: Contact
    const cx = 85;
    doc.text(`Tel: ${companyInfo.phone}`, cx, fy);
    doc.text(`E-Mail: ${companyInfo.email}`, cx, fy + 3.5);
    doc.text(`Web: ${companyInfo.website}`, cx, fy + 7);

    // Right: Bank
    const rx = PAGE.width - PAGE.marginRight;
    doc.text(`${companyInfo.bankName}`, rx, fy, { align: "right" });
    doc.text(`IBAN: ${companyInfo.iban}`, rx, fy + 3.5, { align: "right" });
    doc.text(`USt-IdNr.: ${companyInfo.taxId}`, rx, fy + 7, { align: "right" });

    // Page number
    doc.text(`Seite ${pageNum}`, rx, fy + 12, { align: "right" });
  }

  function checkPageBreak(neededSpace: number): void {
    if (y + neededSpace > PAGE.footerY - 10) {
      addPageFooter();
      doc.addPage();
      pageNum++;
      y = PAGE.marginTop;
      
      // Continuation header
      doc.setFontSize(8);
      doc.setTextColor(...BRAND.gray);
      doc.text(`${companyInfo.name} — Angebot ${quote.quote_number || ""}`, PAGE.marginLeft, y);
      doc.text(`Seite ${pageNum}`, PAGE.width - PAGE.marginRight, y, { align: "right" });
      y += 10;
    }
  }

  function drawText(text: string, x: number, yPos: number, options?: any) {
    doc.text(text, x, yPos, options);
  }

  // ─── Header Bar ───────────────────────────────────────
  // Brand accent bar at top
  doc.setFillColor(...BRAND.primary);
  doc.rect(0, 0, PAGE.width, 6, "F");

  // Subtle gradient line below
  doc.setFillColor(...BRAND.primaryDark);
  doc.rect(0, 6, PAGE.width, 0.5, "F");

  y = 14;

  // ─── Logo / Company Name ───────────────────────────────
  if (logoBase64) {
    try {
      const imgData = logoBase64.startsWith("data:") ? logoBase64 : `data:image/png;base64,${logoBase64}`;
      doc.addImage(imgData, "PNG", PAGE.marginLeft, y, 40, 15);
      y += 18;
    } catch {
      // Fallback to text
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...BRAND.primary);
      doc.text(companyInfo.name, PAGE.marginLeft, y + 8);
      y += 14;
    }
  } else {
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BRAND.primary);
    doc.text(companyInfo.name, PAGE.marginLeft, y + 8);
    y += 14;
  }

  // ─── Company Info (right-aligned) ──────────────────────
  const infoY = 14;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...BRAND.gray);
  const rx = PAGE.width - PAGE.marginRight;
  doc.text(companyInfo.name, rx, infoY, { align: "right" });
  doc.text(`${companyInfo.street}`, rx, infoY + 4, { align: "right" });
  doc.text(`${companyInfo.zip} ${companyInfo.city}`, rx, infoY + 8, { align: "right" });
  doc.text(`Tel: ${companyInfo.phone}`, rx, infoY + 14, { align: "right" });
  doc.text(companyInfo.email, rx, infoY + 18, { align: "right" });

  y = Math.max(y, infoY + 24);

  // ─── Sender Line (small) ──────────────────────────────
  doc.setFontSize(7);
  doc.setTextColor(...BRAND.gray);
  doc.text(`${companyInfo.name} · ${companyInfo.street} · ${companyInfo.zip} ${companyInfo.city}`, PAGE.marginLeft, y);
  
  // Underline
  doc.setDrawColor(...BRAND.lightGray);
  doc.setLineWidth(0.2);
  doc.line(PAGE.marginLeft, y + 1, 100, y + 1);

  y += 6;

  // ─── Customer Address ─────────────────────────────────
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...BRAND.text);

  if (customer) {
    if (customer.company_name) {
      doc.setFont("helvetica", "bold");
      doc.text(customer.company_name, PAGE.marginLeft, y);
      doc.setFont("helvetica", "normal");
      y += 5.5;
    }
    if (customer.first_name || customer.last_name) {
      doc.text(`${customer.first_name || ""} ${customer.last_name}`.trim(), PAGE.marginLeft, y);
      y += 5.5;
    }
    if (customer.street) {
      doc.text(customer.street, PAGE.marginLeft, y);
      y += 5.5;
    }
    if (customer.postal_code || customer.city) {
      doc.text(`${customer.postal_code || ""} ${customer.city || ""}`.trim(), PAGE.marginLeft, y);
      y += 5.5;
    }
  } else {
    doc.text("Kunde", PAGE.marginLeft, y);
    y += 5.5;
  }

  y += 12;

  // ─── Document Title ───────────────────────────────────
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND.primary);
  doc.text("ANGEBOT", PAGE.marginLeft, y);

  // Quote meta info (right side)
  const metaX = rx;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...BRAND.text);

  const metaLines = [
    { label: "Angebots-Nr.:", value: quote.quote_number || "Entwurf" },
    { label: "Datum:", value: new Date(quote.created_at || Date.now()).toLocaleDateString("de-DE") },
  ];
  if (quote.valid_until) {
    metaLines.push({ label: "Gültig bis:", value: new Date(quote.valid_until).toLocaleDateString("de-DE") });
  }

  let metaY = y - 8;
  for (const line of metaLines) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BRAND.gray);
    doc.text(line.label, metaX - 40, metaY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...BRAND.text);
    doc.text(line.value, metaX, metaY, { align: "right" });
    metaY += 5;
  }

  y += 10;

  // ─── Introduction Text ────────────────────────────────
  if (quote.introduction) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BRAND.text);
    const introLines = doc.splitTextToSize(quote.introduction, PAGE.contentWidth);
    checkPageBreak(introLines.length * 4.5 + 5);
    doc.text(introLines, PAGE.marginLeft, y);
    y += introLines.length * 4.5 + 8;
  }

  // ─── Line Items Table ─────────────────────────────────
  // Table header
  checkPageBreak(20);
  doc.setFillColor(...BRAND.primary);
  doc.rect(PAGE.marginLeft, y, PAGE.contentWidth, 8, "F");
  
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND.white);
  doc.text("Pos.", PAGE.marginLeft + 2, y + 5.5);
  doc.text("Beschreibung", PAGE.marginLeft + 14, y + 5.5);
  doc.text("Menge", 118, y + 5.5, { align: "right" });
  doc.text("Einheit", 132, y + 5.5, { align: "center" });
  doc.text("Einzelpreis", 158, y + 5.5, { align: "right" });
  doc.text("Gesamt", PAGE.width - PAGE.marginRight - 2, y + 5.5, { align: "right" });
  y += 10;

  // Table rows
  doc.setFont("helvetica", "normal");
  lineItems.forEach((item, idx) => {
    const descText = item.description || "";
    const descLines = doc.splitTextToSize(descText, 60);
    const rowHeight = Math.max(7, descLines.length * 4 + 3);

    checkPageBreak(rowHeight + 2);

    // Alternating background
    if (idx % 2 === 0) {
      doc.setFillColor(...BRAND.tableAlt);
      doc.rect(PAGE.marginLeft, y - 1, PAGE.contentWidth, rowHeight, "F");
    }

    doc.setFontSize(8.5);
    doc.setTextColor(...BRAND.text);
    
    // Position
    doc.setFont("helvetica", "bold");
    doc.text(String(item.position || idx + 1), PAGE.marginLeft + 2, y + 3);
    
    // Description
    doc.setFont("helvetica", "normal");
    doc.text(descLines, PAGE.marginLeft + 14, y + 3);
    
    // Quantity
    doc.text(String(item.quantity), 118, y + 3, { align: "right" });
    
    // Unit
    doc.setTextColor(...BRAND.gray);
    doc.text(item.unit || "Stk", 132, y + 3, { align: "center" });
    
    // Unit price
    doc.setTextColor(...BRAND.text);
    doc.text(
      formatDE(item.unit_price || 0),
      158,
      y + 3,
      { align: "right" }
    );
    
    // Total
    doc.setFont("helvetica", "bold");
    doc.text(
      formatDE(item.total_price || 0),
      PAGE.width - PAGE.marginRight - 2,
      y + 3,
      { align: "right" }
    );

    y += rowHeight;
  });

  // Table bottom line
  doc.setDrawColor(...BRAND.primary);
  doc.setLineWidth(0.5);
  doc.line(PAGE.marginLeft, y, PAGE.width - PAGE.marginRight, y);
  y += 8;

  // ─── Totals Section ───────────────────────────────────
  checkPageBreak(40);
  
  const totalsX = 140;
  const totalsValX = PAGE.width - PAGE.marginRight - 2;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...BRAND.text);

  // Net
  const netAmount = quote.total_net ?? quote.net_amount ?? 0;
  doc.text("Nettobetrag:", totalsX, y);
  doc.text(formatDE(netAmount), totalsValX, y, { align: "right" });
  y += 6;

  // Tax
  const taxRate = quote.tax_rate || 0;
  const taxAmount = quote.total_tax ?? quote.tax_amount ?? 0;
  doc.text(`MwSt. (${taxRate}%):`, totalsX, y);
  doc.text(formatDE(taxAmount), totalsValX, y, { align: "right" });
  y += 3;

  // Separator
  doc.setDrawColor(...BRAND.lightGray);
  doc.setLineWidth(0.3);
  doc.line(totalsX - 5, y, totalsValX, y);
  y += 6;

  // Gross total with highlight box
  doc.setFillColor(255, 245, 243); // Light orange bg
  doc.roundedRect(totalsX - 8, y - 5, totalsValX - totalsX + 10, 12, 2, 2, "F");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...BRAND.text);
  doc.text("Gesamtbetrag:", totalsX, y + 2);
  doc.setTextColor(...BRAND.primary);
  const grossAmount = quote.total_gross ?? quote.gross_amount ?? 0;
  doc.text(formatDE(grossAmount), totalsValX, y + 2, { align: "right" });

  y += 18;

  // ─── Payment Terms / Remarks ──────────────────────────
  if (quote.payment_terms) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...BRAND.text);
    
    const termsLines = doc.splitTextToSize(quote.payment_terms, PAGE.contentWidth);
    checkPageBreak(termsLines.length * 4 + 10);
    
    doc.text(termsLines, PAGE.marginLeft, y);
    y += termsLines.length * 4 + 10;
  }

  // ─── AGB Section ──────────────────────────────────────
  checkPageBreak(30);
  
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BRAND.text);
  doc.text("Allgemeine Geschäftsbedingungen", PAGE.marginLeft, y);
  y += 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...BRAND.gray);
  
  const agbText = [
    "1. Dieses Angebot ist freibleibend. Irrtümer und Zwischenverkauf vorbehalten.",
    "2. Die Lieferzeit richtet sich nach Verfügbarkeit der Materialien und wird nach Auftragsbestätigung mitgeteilt.",
    "3. Eigentumsvorbehalte gem. § 449 BGB bleiben bis zur vollständigen Bezahlung bestehen.",
    "4. Gewährleistung gemäß den gesetzlichen Bestimmungen.",
    "5. Es gelten die Allgemeinen Geschäftsbedingungen der BROjekt GmbH (einsehbar unter www.brojekt.gmbh/agb).",
  ];
  
  for (const line of agbText) {
    checkPageBreak(5);
    doc.text(line, PAGE.marginLeft, y);
    y += 3.5;
  }

  // ─── Footer on all pages ──────────────────────────────
  addPageFooter();

  // Update total pages (go back and update page numbers)
  const totalPages = pageNum;
  if (totalPages > 1) {
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      // We already wrote page numbers in footer; for multi-page we'd need a second pass
      // jsPDF doesn't easily support "Page X of Y" without plugin, so we keep simple numbering
    }
  }

  return doc;
}

function formatDE(value: number): string {
  return value.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

export function downloadQuotePDF(data: QuotePDFData): void {
  const doc = generateQuotePDF(data);
  const filename = `Angebot_${data.quote.quote_number || "Entwurf"}_BROjekt.pdf`;
  doc.save(filename);
}

export function getQuotePDFBlob(data: QuotePDFData): Blob {
  const doc = generateQuotePDF(data);
  return doc.output("blob");
}
