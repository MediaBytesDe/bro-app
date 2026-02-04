import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const LEXWARE_API_KEY = process.env.LEXWARE_API_KEY;
const LEXWARE_BASE_URL = "https://api.lexoffice.io/v1";

async function lexwareRequest(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${LEXWARE_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${LEXWARE_API_KEY}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Lexware API error: ${response.status} - ${errorText}`);
  }
  
  // Some endpoints return empty body (201 Created)
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

// Find or create contact in Lexware
async function getOrCreateContact(customer: any): Promise<string> {
  if (!customer) {
    throw new Error("Kein Kunde für das Angebot ausgewählt");
  }

  // Check if customer already has a Lexware ID
  if (customer.lexware_id) {
    return customer.lexware_id;
  }

  // Search for existing contact by email
  if (customer.email) {
    const searchResult = await lexwareRequest(`/contacts?email=${encodeURIComponent(customer.email)}`);
    if (searchResult?.content?.length > 0) {
      return searchResult.content[0].id;
    }
  }

  // Create new contact
  const isCompany = !!customer.company_name;
  const contactPayload: any = {
    version: 0,
    roles: { customer: {} },
    addresses: {
      billing: [{
        street: customer.street || "",
        zip: customer.zip || "",
        city: customer.city || "",
        countryCode: "DE",
      }]
    },
    emailAddresses: customer.email ? { business: [customer.email] } : undefined,
    phoneNumbers: customer.phone ? { business: [customer.phone] } : undefined,
  };

  if (isCompany) {
    contactPayload.company = {
      name: customer.company_name,
      contactPersons: customer.first_name || customer.last_name ? [{
        firstName: customer.first_name || "",
        lastName: customer.last_name || "",
      }] : undefined,
    };
  } else {
    contactPayload.person = {
      firstName: customer.first_name || "",
      lastName: customer.last_name || "Unbekannt",
    };
  }

  const result = await lexwareRequest("/contacts", {
    method: "POST",
    body: JSON.stringify(contactPayload),
  });

  return result.id;
}

export async function POST(request: NextRequest) {
  try {
    // Auth check - only admin/mitarbeiter
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("auth_id", user.id)
      .single();

    if (!profile || !["admin", "mitarbeiter", "superadmin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!LEXWARE_API_KEY) {
      return NextResponse.json({ error: "LEXWARE_API_KEY not configured" }, { status: 500 });
    }

    const { quoteId } = await request.json();
    
    if (!quoteId) {
      return NextResponse.json({ error: "Quote ID fehlt" }, { status: 400 });
    }

    // Load quote with items and customer
    const { data: quote, error: quoteError } = await supabase
      .from("wawi_quotes")
      .select(`
        *,
        customer:customers(*),
        items:wawi_quote_items(*)
      `)
      .eq("id", quoteId)
      .single();

    if (quoteError || !quote) {
      return NextResponse.json({ error: "Angebot nicht gefunden" }, { status: 404 });
    }

    // Get or create Lexware contact
    const contactId = await getOrCreateContact(quote.customer);

    // Update customer with Lexware ID if new
    if (quote.customer && !quote.customer.lexware_id) {
      await supabase
        .from("customers")
        .update({ 
          lexware_id: contactId,
          lexware_sync_at: new Date().toISOString(),
        })
        .eq("id", quote.customer.id);
    }

    // Build line items for Lexware
    const sortedItems = (quote.items || []).sort((a: any, b: any) => 
      (a.position_number || 0) - (b.position_number || 0)
    );

    let lineItems: any[] = [];

    if (quote.is_package_deal && quote.package_price) {
      // Komplettpaket: Position 1 = Paketpreis, alle anderen = 0€
      const pkgTitle = quote.package_title || "Photovoltaik-Komplettpaket";

      // Add package item first
      lineItems.push({
        type: "custom",
        name: pkgTitle,
        description: "Schlüsselfertige PV-Anlage inkl. aller unten aufgeführten Komponenten, Montage, Inbetriebnahme und Netzanmeldung.",
        quantity: 1,
        unitName: "Pauschal",
        unitPrice: {
          currency: "EUR",
          netAmount: quote.package_price,
          taxRatePercentage: 0, // PV = 0% MwSt
        },
        discountPercentage: 0,
      });

      // Add other items with 0€
      for (const item of sortedItems) {
        lineItems.push({
          type: "custom",
          name: item.product_name,
          description: item.product_description || "",
          quantity: item.quantity,
          unitName: item.unit || "Stück",
          unitPrice: {
            currency: "EUR",
            netAmount: 0,
            taxRatePercentage: 0,
          },
          discountPercentage: 0,
        });
      }
    } else {
      // Normal quote: all items with individual prices
      for (const item of sortedItems) {
        lineItems.push({
          type: "custom",
          name: item.product_name,
          description: item.product_description || "",
          quantity: item.quantity,
          unitName: item.unit || "Stück",
          unitPrice: {
            currency: "EUR",
            netAmount: item.unit_price,
            taxRatePercentage: item.tax_rate || 0,
          },
          discountPercentage: item.discount_percentage || 0,
        });
      }
    }

    // Build customer name for greeting
    const customerName = quote.customer?.company_name 
      || `${quote.customer?.first_name || ""} ${quote.customer?.last_name || ""}`.trim()
      || "Damen und Herren";

    // Build quotation payload
    const quotationPayload = {
      voucherDate: new Date(quote.quote_date).toISOString(),
      expirationDate: quote.valid_until 
        ? new Date(quote.valid_until).toISOString()
        : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // +14 days default
      address: {
        contactId: contactId,
      },
      lineItems,
      totalPrice: {
        currency: "EUR",
      },
      taxConditions: {
        taxType: "net",
      },
      title: (quote.title || "Angebot").slice(0, 25),
      introduction: quote.introduction || `Sehr geehrte/r ${customerName},\n\nvielen Dank für Ihr Interesse an unseren Produkten. Gerne unterbreite ich Ihnen folgendes Angebot:`,
      remark: quote.remark || "",
    };

    // Create and finalize quotation in Lexware
    const lexwareQuote = await lexwareRequest("/quotations?finalize=true", {
      method: "POST",
      body: JSON.stringify(quotationPayload),
    });

    // Fetch the finalized quote to get the voucherNumber
    const finalizedQuote = await lexwareRequest(`/quotations/${lexwareQuote.id}`);

    // Update our quote with Lexware ID, number and status
    await supabase
      .from("wawi_quotes")
      .update({
        lexware_quotation_id: lexwareQuote.id,
        lexware_quote_number: finalizedQuote.voucherNumber,
        status: "sent",
        updated_at: new Date().toISOString(),
      })
      .eq("id", quoteId);

    return NextResponse.json({
      success: true,
      lexwareId: lexwareQuote.id,
      lexwareNumber: finalizedQuote.voucherNumber,
      message: `Angebot ${finalizedQuote.voucherNumber} erfolgreich zu Lexware übertragen`,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Export fehlgeschlagen";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
