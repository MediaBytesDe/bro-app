import { NextRequest, NextResponse } from "next/server";

const LEXWARE_API_KEY = "1hgePA-GyqCIhCbxfkaB1kYlVvVj0kkTBJeJ6BR4GVZ-doqv";
const LEXWARE_BASE_URL = "https://api.lexoffice.io/v1";

export async function GET(request: NextRequest) {
  try {
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

  } catch (error: any) {
    console.error("PDF fetch error:", error);
    return NextResponse.json(
      { error: error.message || "PDF konnte nicht geladen werden" },
      { status: 500 }
    );
  }
}
