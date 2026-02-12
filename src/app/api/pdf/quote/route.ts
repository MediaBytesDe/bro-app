import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateQuotePDF } from '@/lib/pdf/quote-pdf';
import type { QuoteLineItem, Customer } from '@/types/database';

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check user role and permissions
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("auth_id", user.id)
      .single();

    const isStaff = profile?.role && ["admin", "mitarbeiter", "superadmin"].includes(profile.role);

    const { quoteId } = await request.json();

    if (!quoteId) {
      return NextResponse.json({ error: 'Quote ID required' }, { status: 400 });
    }

    // Fetch quote data from wawi_quotes table
    const { data: wawiQuote, error: quoteError } = await supabase
      .from('wawi_quotes')
      .select('*')
      .eq('id', quoteId)
      .single();

    if (quoteError || !wawiQuote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    // For non-staff users, verify they own the quote
    if (!isStaff) {
      // Verify quote belongs to user's customer record
      const { data: customer } = await supabase
        .from("customers")
        .select("id")
        .eq("auth_user_id", user.id)
        .single();

      if (!customer || wawiQuote.customer_id !== customer.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Fetch customer data
    let customer: Customer | null = null;
    if (wawiQuote.customer_id) {
      const { data: customerData } = await supabase
        .from('customers')
        .select('*')
        .eq('id', wawiQuote.customer_id)
        .single();
      customer = customerData;
    }

    // Fetch quote items
    const { data: items } = await supabase
      .from('wawi_quote_items')
      .select('*')
      .eq('quote_id', quoteId)
      .order('position_number', { ascending: true });

    // Transform wawi_quotes data for PDF generator
    const quote = {
      quote_number: wawiQuote.quote_number || '',
      title: wawiQuote.title || 'Angebot',
      created_at: wawiQuote.created_at,
      valid_until: wawiQuote.valid_until,
      tax_rate: wawiQuote.tax_rate,
      introduction: wawiQuote.introduction_text,
      payment_terms: wawiQuote.footer_text,
      total_net: wawiQuote.subtotal,
      total_tax: wawiQuote.tax_amount,
      total_gross: wawiQuote.total_amount,
      line_items: (items || []).map((item): QuoteLineItem => ({
        id: item.id,
        position: item.position_number,
        description: item.product_description || item.product_name,
        quantity: item.quantity,
        unit: item.unit || 'Stk',
        unit_price: item.unit_price,
        total_price: item.total_price,
      })),
    };

    // Generate PDF using existing jsPDF logic
    const pdf = generateQuotePDF({
      quote,
      customer,
    });

    // Convert to buffer
    const pdfBuffer = Buffer.from(pdf.output('arraybuffer'));

    // Return PDF
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="angebot-${wawiQuote.quote_number || quoteId}.pdf"`,
        'Cache-Control': 'private, no-cache',
      },
    });
  } catch (error) {
    console.error('[PDF Generation Error]', error);
    return NextResponse.json(
      { error: 'PDF generation failed' },
      { status: 500 }
    );
  }
}
