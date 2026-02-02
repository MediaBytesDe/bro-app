/**
 * Lexware Sync Service
 * 
 * Handles synchronization between BROjekt customers and Lexware contacts.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getLexwareClient, LexwareClient } from "./client";
import type { Customer } from "@/types/database";

export interface SyncResult {
  success: boolean;
  customerId: string;
  lexwareId?: string;
  error?: string;
  action: "created" | "updated" | "skipped" | "error";
}

/**
 * Sync a single customer to Lexware
 */
export async function syncCustomerToLexware(
  customerId: string
): Promise<SyncResult> {
  const supabase = createAdminClient();
  const lexware = getLexwareClient();

  try {
    // Get customer from DB
    const { data: customer, error } = await supabase
      .from("customers")
      .select("*")
      .eq("id", customerId)
      .single();

    if (error || !customer) {
      return {
        success: false,
        customerId,
        error: "Customer not found",
        action: "error",
      };
    }

    // Convert to Lexware format
    const lexwareContact = LexwareClient.customerToContact(customer);

    // Check if already synced
    if (customer.lexware_id) {
      // Update existing contact
      try {
        // Get current version
        const existing = await lexware.getContact(customer.lexware_id);
        const updated = {
          ...lexwareContact,
          id: customer.lexware_id,
          version: existing.version,
        };

        await lexware.updateContact(customer.lexware_id, updated);

        // Update sync timestamp
        await supabase
          .from("customers")
          .update({ lexware_sync_at: new Date().toISOString() })
          .eq("id", customerId);

        return {
          success: true,
          customerId,
          lexwareId: customer.lexware_id,
          action: "updated",
        };
      } catch (err) {
        // If contact doesn't exist in Lexware anymore, create new
        if ((err as { status?: number }).status === 404) {
          return createNewLexwareContact(supabase, lexware, customer, customerId);
        }
        throw err;
      }
    }

    // Create new contact
    return createNewLexwareContact(supabase, lexware, customer, customerId);
  } catch (err) {
    console.error("Lexware sync error:", err);
    return {
      success: false,
      customerId,
      error: err instanceof Error ? err.message : "Unknown error",
      action: "error",
    };
  }
}

async function createNewLexwareContact(
  supabase: ReturnType<typeof createAdminClient>,
  lexware: LexwareClient,
  customer: Customer,
  customerId: string
): Promise<SyncResult> {
  const lexwareContact = LexwareClient.customerToContact(customer);
  const result = await lexware.createContact(lexwareContact);

  // Save Lexware ID to DB
  await supabase
    .from("customers")
    .update({
      lexware_id: result.id,
      lexware_sync_at: new Date().toISOString(),
    })
    .eq("id", customerId);

  return {
    success: true,
    customerId,
    lexwareId: result.id,
    action: "created",
  };
}

/**
 * Sync multiple customers to Lexware (batch)
 */
export async function syncCustomersToLexware(
  customerIds?: string[]
): Promise<SyncResult[]> {
  const supabase = createAdminClient();
  
  // Get customers to sync
  let query = supabase
    .from("customers")
    .select("id")
    .eq("status", "active");

  if (customerIds?.length) {
    query = query.in("id", customerIds);
  }

  const { data: customers, error } = await query;

  if (error || !customers) {
    return [
      {
        success: false,
        customerId: "batch",
        error: "Failed to fetch customers",
        action: "error",
      },
    ];
  }

  // Sync each customer with rate limiting (500ms between requests)
  const results: SyncResult[] = [];
  
  for (const customer of customers) {
    const result = await syncCustomerToLexware(customer.id);
    results.push(result);
    
    // Small delay to respect rate limits (already handled in client, but extra safety)
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return results;
}

/**
 * Import contacts from Lexware to BROjekt
 */
export async function importFromLexware(): Promise<{
  imported: number;
  skipped: number;
  errors: string[];
}> {
  const supabase = createAdminClient();
  const lexware = getLexwareClient();

  const stats = {
    imported: 0,
    skipped: 0,
    errors: [] as string[],
  };

  try {
    // Fetch all customers from Lexware
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const response = await lexware.listContacts({
        page,
        size: 100,
        customer: true,
      });

      for (const contact of response.content) {
        try {
          // Check if already imported
          const { data: existing } = await supabase
            .from("customers")
            .select("id")
            .eq("lexware_id", contact.id)
            .single();

          if (existing) {
            stats.skipped++;
            continue;
          }

          // Convert to BROjekt format
          const isCompany = !!contact.company;
          const primaryPerson = contact.company?.contactPersons?.find(p => p.primary);
          const address = contact.addresses?.billing?.[0];

          const { error: insertError } = await supabase.from("customers").insert({
            lexware_id: contact.id,
            customer_type: isCompany ? "business" : "private",
            company_name: contact.company?.name || null,
            first_name: isCompany
              ? primaryPerson?.firstName || null
              : contact.person?.firstName || null,
            last_name: isCompany
              ? primaryPerson?.lastName || ""
              : contact.person?.lastName || "",
            email: contact.emailAddresses?.business?.[0] || null,
            phone: contact.phoneNumbers?.business?.[0] || null,
            mobile: contact.phoneNumbers?.mobile?.[0] || null,
            street: address?.street || null,
            postal_code: address?.zip || null,
            city: address?.city || null,
            country: address?.countryCode === "DE" ? "Deutschland" : address?.countryCode || null,
            tax_id: contact.company?.taxNumber || contact.company?.vatRegistrationId || null,
            notes: contact.note || null,
            status: contact.archived ? "inactive" : "active",
            lexware_sync_at: new Date().toISOString(),
          });

          if (insertError) {
            console.error("Insert error for", contact.id, insertError);
            stats.errors.push(`Contact ${contact.id}: ${insertError.message}`);
            continue;
          }

          stats.imported++;
        } catch (err) {
          stats.errors.push(
            `Contact ${contact.id}: ${err instanceof Error ? err.message : "Unknown error"}`
          );
        }
      }

      hasMore = page < response.totalPages - 1;
      page++;
    }
  } catch (err) {
    stats.errors.push(`Fetch error: ${err instanceof Error ? err.message : "Unknown error"}`);
  }

  return stats;
}
