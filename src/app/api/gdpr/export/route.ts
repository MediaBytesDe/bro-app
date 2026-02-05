/**
 * GDPR Data Export API
 * Allows customers to export all their personal data
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logDataExport } from '@/lib/audit-log';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get customer data
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .eq('auth_user_id', user.id)
      .single();

    if (customerError || !customer) {
      return NextResponse.json(
        { error: 'Customer profile not found' },
        { status: 404 }
      );
    }

    // Collect all customer data
    const exportData = {
      exportDate: new Date().toISOString(),
      personalData: {
        id: customer.id,
        email: customer.email,
        firstName: customer.first_name,
        lastName: customer.last_name,
        companyName: customer.company_name,
        phone: customer.phone,
        address: customer.address,
        city: customer.city,
        zipCode: customer.zip_code,
        country: customer.country,
        createdAt: customer.created_at,
      },
      projects: [],
      documents: [],
      messages: [],
      quotes: [],
    };

    // Get projects
    const { data: projects } = await supabase
      .from('projects')
      .select('id, name, description, status, start_date, end_date, created_at')
      .eq('customer_id', customer.id);

    exportData.projects = projects || [];

    // Get documents
    const { data: documents } = await supabase
      .from('documents')
      .select('id, name, document_type, file_name, file_size, created_at')
      .eq('customer_id', customer.id);

    exportData.documents = documents || [];

    // Get messages (from projects)
    if (projects && projects.length > 0) {
      const projectIds = projects.map(p => p.id);
      const { data: messages } = await supabase
        .from('messages')
        .select('id, text, sender_type, sender_name, created_at, project_id')
        .in('project_id', projectIds);

      exportData.messages = messages || [];
    }

    // Get quotes
    const { data: quotes } = await supabase
      .from('quotes')
      .select('id, quote_number, total_amount, status, created_at')
      .eq('customer_id', customer.id);

    exportData.quotes = quotes || [];

    // Log the export
    await logDataExport(
      user.id,
      customer.email || user.email || 'unknown',
      'all',
      request
    );

    // Return as JSON download
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="data-export-${customer.id}-${Date.now()}.json"`,
      },
    });
  } catch (error) {
    console.error('Data export error:', error);
    return NextResponse.json(
      { error: 'Export failed' },
      { status: 500 }
    );
  }
}
