const { createClient } = require('@supabase/supabase-js');

// Source (WAWI)
const srcUrl = 'https://tgunbwlnmcvzqfawamds.supabase.co';
const srcKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRndW5id2xubWN2enFmYXdhbWRzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjgxNDIzOSwiZXhwIjoyMDc4MzkwMjM5fQ.xrWBli0S5bELtIngZYhieU8q_eblxM5xEINeoV4RaDI';

// Destination (bro-app Supabase Cloud)
const dstUrl = 'https://veneuojbqyyturxvtxjm.supabase.co';
const dstKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlbmV1b2picXl5dHVyeHZ0eGptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDEwODU1MiwiZXhwIjoyMDg1Njg0NTUyfQ.ctyEacRmiKsxqUf1hrvVO29JgtdsL4YlOLvECGd4eRU';

const src = createClient(srcUrl, srcKey);
const dst = createClient(dstUrl, dstKey);

async function migrate(table, transform = null) {
  console.log(`Migrating ${table}...`);
  
  const { data, error } = await src.from(table).select('*');
  if (error) {
    console.error(`  Error fetching ${table}:`, error.message);
    return 0;
  }
  
  if (!data || data.length === 0) {
    console.log(`  No data in ${table}`);
    return 0;
  }
  
  const records = transform ? data.map(transform) : data;
  
  const { error: insertError } = await dst.from(table).upsert(records, { 
    onConflict: 'id',
    ignoreDuplicates: false 
  });
  
  if (insertError) {
    console.error(`  Error inserting ${table}:`, insertError.message);
    return 0;
  }
  
  console.log(`  ✓ ${records.length} records`);
  return records.length;
}

async function main() {
  console.log('=== WAWI Data Migration ===\n');
  
  // 1. Categories
  await migrate('product_categories');
  
  // 2. Units
  await migrate('product_units');
  
  // 3. Products
  await migrate('products');
  
  // 4. Quotes (need to check if customer exists, otherwise set null)
  const { data: quotes } = await src.from('quotes').select('*');
  if (quotes && quotes.length > 0) {
    // Get existing customer IDs in destination
    const { data: customers } = await dst.from('customers').select('id');
    const customerIds = new Set(customers?.map(c => c.id) || []);
    
    const transformedQuotes = quotes.map(q => ({
      ...q,
      customer_id: customerIds.has(q.customer_id) ? q.customer_id : null
    }));
    
    const { error } = await dst.from('wawi_quotes').upsert(transformedQuotes, {
      onConflict: 'id',
      ignoreDuplicates: false
    });
    
    if (error) {
      console.error('Error inserting quotes:', error.message);
    } else {
      console.log(`Migrating wawi_quotes...\n  ✓ ${transformedQuotes.length} records`);
    }
  }
  
  // 5. Quote Items
  const { data: items } = await src.from('quote_items').select('*');
  if (items && items.length > 0) {
    const { error } = await dst.from('wawi_quote_items').upsert(items, {
      onConflict: 'id',
      ignoreDuplicates: false
    });
    
    if (error) {
      console.error('Error inserting quote_items:', error.message);
    } else {
      console.log(`Migrating wawi_quote_items...\n  ✓ ${items.length} records`);
    }
  }
  
  console.log('\n=== Migration Complete ===');
}

main().catch(console.error);
