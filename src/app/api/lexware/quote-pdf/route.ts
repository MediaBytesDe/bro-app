import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const LEXWARE_API_KEY = process.env.LEXWARE_API_KEY;
const LEXWARE_BASE_URL = "https://api.lexoffice.io/v1";

export async function GET(request: NextRequest) {
  try {
    // Auth check - only authenticated users
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!LEXWARE_API_KEY) {
      return NextResponse.json({ error: "LEXWARE_API_KEY not configured" }, { status: 500 });
    }

    const lexwareId = request.nextUrl.searchParams.get("lexwareId");
    
    if (!lexwareId) {
      return NextResponse.json({ error: "Lexware ID fehlt" }, { status: 400 });
    }

    // Step 1: Get quotation details to get documentFileId
    const quotationResponse = await fetch(`${LEXWARE_BASE_URL}/quotations/${lexwareId}`, {
      headers: {
        "Authorization": `Bearer ${LEXWARE_API_KEY}`,
        "Accept": "application/json",
      },
    });

    if (!quotationResponse.ok) {
      const errorText = await quotationResponse.text();
      return NextResponse.json(
        { error: `Angebot nicht gefunden: ${errorText}` },
        { status: quotationResponse.status }
      );
    }

    const quotation = await quotationResponse.json();
    const documentFileId = quotation.files?.documentFileId;

    if (!documentFileId) {
      return NextResponse.json(
        { error: "Kein PDF für dieses Angebot verfügbar" },
        { status: 404 }
      );
    }

    // Step 2: Fetch the PDF file
    const fileResponse = await fetch(`${LEXWARE_BASE_URL}/files/${documentFileId}`, {
      headers: {
        "Authorization": `Bearer ${LEXWARE_API_KEY}`,
        "Accept": "application/pdf",
      },
    });

    if (!fileResponse.ok) {
      const errorText = await fileResponse.text();
      return NextResponse.json(
        { error: `PDF konnte nicht geladen werden: ${errorText}` },
        { status: fileResponse.status }
      );
    }

    // Get the PDF as ArrayBuffer
    const pdfBuffer = await fileResponse.arrayBuffer();

    // Return the PDF with correct headers
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Angebot-${quotation.voucherNumber || lexwareId}.pdf"`,
        "Cache-Control": "private, max-age=3600",
      },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "PDF konnte nicht geladen werden";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
