/**
 * Quote PDF Generator
 * 
 * Generates PDF documents for quotes using jsPDF.
 */

import { jsPDF } from "jspdf";
import type { Quote, QuoteLineItem, Customer } from "@/types/database";

interface QuotePDFData {
  quote: Quote;
  customer: Customer | null;
  companyInfo?: {
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
  };
}

const DEFAULT_COMPANY = {
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
};

export function generateQuotePDF(data: QuotePDFData): jsPDF {
  const { quote, customer, companyInfo = DEFAULT_COMPANY } = data;
  const doc = new jsPDF();
  const lineItems = (quote.line_items as QuoteLineItem[]) || [];

  // Colors
  const primaryColor: [number, number, number] = [234, 88, 12]; // Orange
  const textColor: [number, number, number] = [30, 30, 30];
  const grayColor: [number, number, number] = [120, 120, 120];

  let y = 20;

  // Header - Company Logo Area
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 210, 8, "F");

  // Company Info (right side)
  doc.setFontSize(10);
  doc.setTextColor(...grayColor);
  doc.text(companyInfo.name, 200, y, { align: "right" });
  y += 5;
  doc.text(`${companyInfo.street}, ${companyInfo.zip} ${companyInfo.city}`, 200, y, { align: "right" });
  y += 5;
  doc.text(`Tel: ${companyInfo.phone}`, 200, y, { align: "right" });
  y += 5;
  doc.text(companyInfo.email, 200, y, { align: "right" });

  y = 20;

  // Sender line (small)
  doc.setFontSize(7);
  doc.setTextColor(...grayColor);
  doc.text(`${companyInfo.name} · ${companyInfo.street} · ${companyInfo.zip} ${companyInfo.city}`, 20, y);

  y += 10;

  // Customer Address
  doc.setFontSize(11);
  doc.setTextColor(...textColor);
  
  if (customer) {
    if (customer.company_name) {
      doc.text(customer.company_name, 20, y);
      y += 6;
    }
    if (customer.first_name || customer.last_name) {
      doc.text(`${customer.first_name || ""} ${customer.last_name}`.trim(), 20, y);
      y += 6;
    }
    if (customer.street) {
      doc.text(customer.street, 20, y);
      y += 6;
    }
    if (customer.zip || customer.city) {
      doc.text(`${customer.zip || ""} ${customer.city || ""}`.trim(), 20, y);
      y += 6;
    }
  } else {
    doc.text("Kunde", 20, y);
    y += 6;
  }

  y += 15;

  // Document Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...primaryColor);
  doc.text("ANGEBOT", 20, y);

  // Quote Number & Date (right side)
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...textColor);
  doc.text(`Angebots-Nr.: ${quote.quote_number || "-"}`, 200, y - 6, { align: "right" });
  doc.text(`Datum: ${new Date(quote.created_at || Date.now()).toLocaleDateString("de-DE")}`, 200, y, { align: "right" });
  if (quote.valid_until) {
    doc.text(`Gültig bis: ${new Date(quote.valid_until).toLocaleDateString("de-DE")}`, 200, y + 6, { align: "right" });
  }

  y += 15;

  // Introduction
  if (quote.introduction) {
    doc.setFontSize(10);
    doc.setTextColor(...textColor);
    const introLines = doc.splitTextToSize(quote.introduction, 170);
    doc.text(introLines, 20, y);
    y += introLines.length * 5 + 10;
  }

  // Line Items Table
  // Header
  doc.setFillColor(245, 245, 245);
  doc.rect(20, y, 170, 8, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...textColor);
  doc.text("Pos.", 22, y + 5.5);
  doc.text("Beschreibung", 35, y + 5.5);
  doc.text("Menge", 120, y + 5.5, { align: "right" });
  doc.text("Einzelpreis", 150, y + 5.5, { align: "right" });
  doc.text("Gesamt", 188, y + 5.5, { align: "right" });
  y += 10;

  // Items
  doc.setFont("helvetica", "normal");
  lineItems.forEach((item, idx) => {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }

    const descLines = doc.splitTextToSize(item.description || "", 75);
    const rowHeight = Math.max(6, descLines.length * 4 + 2);

    // Alternating row background
    if (idx % 2 === 1) {
      doc.setFillColor(250, 250, 250);
      doc.rect(20, y - 1, 170, rowHeight, "F");
    }

    doc.setFontSize(9);
    doc.text(String(item.position || idx + 1), 22, y + 3);
    doc.text(descLines, 35, y + 3);
    doc.text(`${item.quantity} ${item.unit || ""}`, 120, y + 3, { align: "right" });
    doc.text(
      (item.unit_price || 0).toLocaleString("de-DE", { style: "currency", currency: "EUR" }),
      150,
      y + 3,
      { align: "right" }
    );
    doc.text(
      (item.total_price || 0).toLocaleString("de-DE", { style: "currency", currency: "EUR" }),
      188,
      y + 3,
      { align: "right" }
    );

    y += rowHeight;
  });

  y += 5;

  // Totals
  doc.setDrawColor(200, 200, 200);
  doc.line(120, y, 190, y);
  y += 8;

  doc.setFontSize(10);
  doc.text("Nettobetrag:", 140, y);
  doc.text(
    (quote.total_net || 0).toLocaleString("de-DE", { style: "currency", currency: "EUR" }),
    188,
    y,
    { align: "right" }
  );
  y += 6;

  doc.text(`MwSt. (${quote.tax_rate || 19}%):`, 140, y);
  doc.text(
    (quote.total_tax || 0).toLocaleString("de-DE", { style: "currency", currency: "EUR" }),
    188,
    y,
    { align: "right" }
  );
  y += 2;

  doc.setDrawColor(200, 200, 200);
  doc.line(120, y, 190, y);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Gesamtbetrag:", 140, y);
  doc.setTextColor(...primaryColor);
  doc.text(
    (quote.total_gross || 0).toLocaleString("de-DE", { style: "currency", currency: "EUR" }),
    188,
    y,
    { align: "right" }
  );

  y += 15;

  // Payment Terms
  if (quote.payment_terms) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...textColor);
    doc.text("Zahlungsbedingungen:", 20, y);
    y += 5;
    doc.setTextColor(...grayColor);
    const termsLines = doc.splitTextToSize(quote.payment_terms, 170);
    doc.text(termsLines, 20, y);
    y += termsLines.length * 4 + 10;
  }

  // Footer
  const footerY = 280;
  doc.setFontSize(8);
  doc.setTextColor(...grayColor);
  doc.text(companyInfo.name, 20, footerY);
  doc.text(`USt-IdNr.: ${companyInfo.taxId}`, 80, footerY);
  doc.text(`${companyInfo.bankName} · IBAN: ${companyInfo.iban}`, 140, footerY);

  return doc;
}

export function downloadQuotePDF(data: QuotePDFData): void {
  const doc = generateQuotePDF(data);
  const filename = `Angebot_${data.quote.quote_number || "Entwurf"}.pdf`;
  doc.save(filename);
}

export function getQuotePDFBlob(data: QuotePDFData): Blob {
  const doc = generateQuotePDF(data);
  return doc.output("blob");
}
