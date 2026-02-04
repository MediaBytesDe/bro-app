const fs = require('fs');
const { Client } = require('pg');

const client = new Client({
  host: 'db.veneuojbqyyturxvtxjm.supabase.co',
  port: 5432,
  user: 'postgres',
  password: 'vSAcA4BSkQS6elA8',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  console.log('Connected to Supabase Cloud');
  
  // Products
  const products = JSON.parse(fs.readFileSync('/tmp/wawi_products.json', 'utf8'));
  console.log(`\nMigrating ${products.length} products...`);
  
  for (const p of products) {
    const desc = (p.description || '').replace(/'/g, "''");
    const name = (p.name || '').replace(/'/g, "''");
    const cat = (p.category || '').replace(/'/g, "''");
    const mfr = (p.manufacturer || '').replace(/'/g, "''");
    const loc = (p.location || '').replace(/'/g, "''");
    
    const sql = `
      INSERT INTO products (
        id, created_at, updated_at, name, description, category, manufacturer, sku,
        purchase_list_price, supplier_discount, supplier_skonto, purchase_costs,
        overhead_percentage, cost_price, profit_margin, customer_skonto,
        default_customer_discount, tax_rate, target_purchase_price, bare_purchase_price,
        reference_price, bare_selling_price, target_selling_price, net_selling_price,
        gross_selling_price, recommended_retail_price, stock_quantity, min_stock_level,
        location, unit, standard_quantity, status, lexware_article_id
      ) VALUES (
        '${p.id}', '${p.created_at}', '${p.updated_at}', '${name}', '${desc}', '${cat}', '${mfr}', '${p.sku}',
        ${p.purchase_list_price}, ${p.supplier_discount}, ${p.supplier_skonto}, ${p.purchase_costs},
        ${p.overhead_percentage}, ${p.cost_price}, ${p.profit_margin}, ${p.customer_skonto},
        ${p.default_customer_discount}, ${p.tax_rate}, ${p.target_purchase_price}, ${p.bare_purchase_price},
        ${p.reference_price}, ${p.bare_selling_price}, ${p.target_selling_price}, ${p.net_selling_price},
        ${p.gross_selling_price}, ${p.recommended_retail_price}, ${p.stock_quantity}, ${p.min_stock_level},
        '${loc}', '${p.unit}', ${p.standard_quantity}, '${p.status}', ${p.lexware_article_id ? `'${p.lexware_article_id}'` : 'NULL'}
      ) ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        category = EXCLUDED.category,
        purchase_list_price = EXCLUDED.purchase_list_price,
        cost_price = EXCLUDED.cost_price,
        profit_margin = EXCLUDED.profit_margin,
        net_selling_price = EXCLUDED.net_selling_price,
        bare_purchase_price = EXCLUDED.bare_purchase_price,
        bare_selling_price = EXCLUDED.bare_selling_price
    `;
    
    try {
      await client.query(sql);
      console.log(`  ✓ ${p.sku}`);
    } catch (err) {
      console.error(`  ✗ ${p.sku}: ${err.message}`);
    }
  }
  
  // Quotes
  const quotes = JSON.parse(fs.readFileSync('/tmp/wawi_quotes.json', 'utf8'));
  console.log(`\nMigrating ${quotes.length} quotes...`);
  
  for (const q of quotes) {
    const intro = (q.introduction || '').replace(/'/g, "''");
    const remark = (q.remark || '').replace(/'/g, "''");
    const title = (q.title || 'Angebot').replace(/'/g, "''");
    const notes = (q.notes || '').replace(/'/g, "''");
    const inotes = (q.internal_notes || '').replace(/'/g, "''");
    
    const sql = `
      INSERT INTO wawi_quotes (
        id, created_at, updated_at, customer_id, quote_number, lexware_quote_number,
        lexware_quotation_id, quote_date, valid_until, status, subtotal,
        discount_percentage, discount_amount, tax_rate, tax_amount, total_amount,
        total_margin, margin_percentage, rounding_amount, title, introduction,
        remark, notes, internal_notes, is_package_deal, tax_type
      ) VALUES (
        '${q.id}', '${q.created_at}', '${q.updated_at}', 
        NULL, -- customer_id set to NULL (WAWI customers not migrated)
        ${q.quote_number ? `'${q.quote_number}'` : 'NULL'},
        ${q.lexware_quote_number ? `'${q.lexware_quote_number}'` : 'NULL'},
        ${q.lexware_quotation_id ? `'${q.lexware_quotation_id}'` : 'NULL'},
        '${q.quote_date}',
        ${q.valid_until ? `'${q.valid_until}'` : 'NULL'},
        '${q.status}',
        ${q.subtotal || 0}, ${q.discount_percentage || 0}, ${q.discount_amount || 0},
        ${q.tax_rate || 0}, ${q.tax_amount || 0}, ${q.total_amount || 0},
        ${q.total_margin || 0}, ${q.margin_percentage || 0}, ${q.rounding_amount || 0},
        '${title}', '${intro}', '${remark}', '${notes}', '${inotes}',
        ${q.is_package_deal || false}, '${q.tax_type || 'standard'}'
      ) ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        total_amount = EXCLUDED.total_amount,
        introduction = EXCLUDED.introduction,
        remark = EXCLUDED.remark
    `;
    
    try {
      await client.query(sql);
      console.log(`  ✓ ${q.lexware_quote_number || q.id.slice(0,8)}`);
    } catch (err) {
      console.error(`  ✗ ${q.id.slice(0,8)}: ${err.message}`);
    }
  }
  
  // Quote Items
  const items = JSON.parse(fs.readFileSync('/tmp/wawi_quote_items.json', 'utf8'));
  console.log(`\nMigrating ${items.length} quote items...`);
  
  for (const i of items) {
    const pname = (i.product_name || '').replace(/'/g, "''");
    const pdesc = (i.product_description || '').replace(/'/g, "''");
    
    const sql = `
      INSERT INTO wawi_quote_items (
        id, created_at, quote_id, product_id, position_number, product_name,
        product_description, sku, quantity, unit, purchase_price, unit_price,
        discount_percentage, total_price, margin_amount, margin_percentage,
        tax_rate, tax_amount, is_package_deal
      ) VALUES (
        '${i.id}', '${i.created_at}', '${i.quote_id}',
        ${i.product_id ? `'${i.product_id}'` : 'NULL'},
        ${i.position_number}, '${pname}', '${pdesc}',
        ${i.sku ? `'${i.sku}'` : 'NULL'},
        ${i.quantity}, '${i.unit}', ${i.purchase_price || 0}, ${i.unit_price || 0},
        ${i.discount_percentage || 0}, ${i.total_price || 0},
        ${i.margin_amount || 0}, ${i.margin_percentage || 0},
        ${i.tax_rate || 0}, ${i.tax_amount || 0}, ${i.is_package_deal || false}
      ) ON CONFLICT (id) DO UPDATE SET
        product_name = EXCLUDED.product_name,
        unit_price = EXCLUDED.unit_price,
        total_price = EXCLUDED.total_price
    `;
    
    try {
      await client.query(sql);
    } catch (err) {
      console.error(`  ✗ ${i.id.slice(0,8)}: ${err.message}`);
    }
  }
  console.log(`  ✓ Done`);
  
  await client.end();
  console.log('\n=== Migration Complete ===');
}

main().catch(console.error);
