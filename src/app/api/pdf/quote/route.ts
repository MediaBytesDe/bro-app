import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateQuotePDF } from '@/lib/pdf/quote-pdf';
import type { Quote, QuoteLineItem, Customer } from '@/types/database';

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    // Transform wawi_quotes data to match Quote type expected by PDF generator
    const quote: Quote = {
      id: wawiQuote.id,
      customer_id: wawiQuote.customer_id || '',
      project_id: wawiQuote.project_id,
      lead_id: wawiQuote.lead_id,
      lexware_quote_id: wawiQuote.lexware_quotation_id,
      lexware_sync_at: null,
      quote_number: wawiQuote.quote_number || '',
      title: wawiQuote.title || 'Angebot',
      description: wawiQuote.introduction_text,
      status: wawiQuote.status === 'draft' ? 'draft' :
              wawiQuote.status === 'sent' ? 'sent' :
              wawiQuote.status === 'accepted' ? 'accepted' : 'draft',
      net_amount: wawiQuote.subtotal,
      tax_rate: wawiQuote.tax_rate,
      tax_amount: wawiQuote.tax_amount,
      gross_amount: wawiQuote.total_amount,
      discount_percent: wawiQuote.discount_percentage,
      discount_amount: wawiQuote.discount_amount,
      line_items: (items || []).map((item): QuoteLineItem => ({
        position: item.position_number,
        description: item.product_description || item.product_name,
        quantity: item.quantity,
        unit: item.unit || 'Stk',
        unit_price: item.unit_price,
        total_price: item.total_price,
      })),
      valid_until: wawiQuote.valid_until,
      sent_at: null,
      viewed_at: null,
      accepted_at: null,
      rejected_at: null,
      pdf_url: null,
      pdf_generated_at: null,
      internal_notes: wawiQuote.internal_notes,
      customer_notes: wawiQuote.notes,
      payment_terms: wawiQuote.footer_text,
      introduction: wawiQuote.introduction_text,
      created_by: null,
      created_at: wawiQuote.created_at,
      updated_at: wawiQuote.updated_at,
      total_net: wawiQuote.subtotal,
      total_tax: wawiQuote.tax_amount,
      total_gross: wawiQuote.total_amount,
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
