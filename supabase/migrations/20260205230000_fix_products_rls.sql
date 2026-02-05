-- Fix products RLS policies - auth.role() was incorrect
-- Should check if user exists in users table, not check auth.role()

-- Drop incorrect policies
DROP POLICY IF EXISTS "All authenticated users can view products" ON products;
DROP POLICY IF EXISTS "All authenticated users can view product categories" ON product_categories;
DROP POLICY IF EXISTS "All authenticated users can view product units" ON product_units;
DROP POLICY IF EXISTS "All authenticated users can view trades" ON trades;

-- products - Correct policy: Check if user exists in users table
CREATE POLICY "Authenticated users can view products" ON products
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid())
  );

-- product_categories
CREATE POLICY "Authenticated users can view product categories" ON product_categories
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid())
  );

-- product_units
CREATE POLICY "Authenticated users can view product units" ON product_units
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid())
  );

-- trades
CREATE POLICY "Authenticated users can view trades" ON trades
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid())
  );
