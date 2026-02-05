/**
 * GDPR Data Deletion API
 * Allows customers to request deletion of all their personal data
 * (Right to be Forgotten)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logDataDeletion } from '@/lib/audit-log';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminSupabase = createAdminClient();

    // Get customer data
    const { data: customer, error: customerError } = await adminSupabase
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

    // Log deletion request BEFORE deleting
    await logDataDeletion(
      user.id,
      customer.email || user.email || 'unknown',
      request
    );

    // GDPR Deletion Process:
    // 1. Anonymize customer data (keep records for legal/accounting but remove PII)
    // 2. Delete auth account
    // 3. Mark as deleted

    // Anonymize customer data instead of deleting (for legal/accounting compliance)
    await adminSupabase
      .from('customers')
      .update({
        email: `deleted-${customer.id}@anonymized.local`,
        first_name: '[DELETED]',
        last_name: '[DELETED]',
        company_name: '[DELETED]',
        phone: null,
        address: null,
        city: null,
        zip_code: null,
        country: null,
        auth_user_id: null, // Remove link to auth
        // Add deletion marker
        notes: (customer.notes || '') + `\n[GDPR DELETION REQUEST: ${new Date().toISOString()}]`,
      })
      .eq('id', customer.id);

    // Delete messages (or anonymize sender info)
    const { data: projects } = await adminSupabase
      .from('projects')
      .select('id')
      .eq('customer_id', customer.id);

    if (projects && projects.length > 0) {
      const projectIds = projects.map(p => p.id);

      // Anonymize messages instead of deleting (keep for project history)
      await adminSupabase
        .from('messages')
        .update({
          sender_name: '[DELETED USER]',
        })
        .in('project_id', projectIds)
        .eq('sender_type', 'customer');
    }

    // Delete documents uploaded by customer
    // NOTE: In production, you might want to keep documents for legal reasons
    // but remove any PII metadata
    await adminSupabase
      .from('documents')
      .delete()
      .eq('customer_id', customer.id);

    // Delete auth account (this removes login ability)
    await adminSupabase.auth.admin.deleteUser(user.id);

    return NextResponse.json({
      success: true,
      message: 'Your data has been anonymized and your account has been deleted.',
    });
  } catch (error) {
    console.error('Data deletion error:', error);
    return NextResponse.json(
      { error: 'Deletion failed' },
      { status: 500 }
    );
  }
}
