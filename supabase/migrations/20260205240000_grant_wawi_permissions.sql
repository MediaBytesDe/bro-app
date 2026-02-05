-- Grant permissions for WAWI tables to authenticated users
-- These are required BEFORE RLS policies can work

-- wawi_quotes
GRANT ALL ON wawi_quotes TO authenticated;
GRANT ALL ON wawi_quotes TO service_role;

-- wawi_quote_items
GRANT ALL ON wawi_quote_items TO authenticated;
GRANT ALL ON wawi_quote_items TO service_role;

-- products (in case it's missing)
GRANT ALL ON products TO authenticated;
GRANT ALL ON products TO service_role;

-- product_categories
GRANT ALL ON product_categories TO authenticated;
GRANT ALL ON product_categories TO service_role;

-- product_units
GRANT ALL ON product_units TO authenticated;
GRANT ALL ON product_units TO service_role;

-- trades
GRANT ALL ON trades TO authenticated;
GRANT ALL ON trades TO service_role;
