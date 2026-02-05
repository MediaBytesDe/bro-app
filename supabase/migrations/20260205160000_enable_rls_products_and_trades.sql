-- Enable RLS on products, product_categories, product_units, and trades
-- Security: Read access for all authenticated users, write access for staff only

-- products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view products" ON products
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Staff can manage products" ON products
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'mitarbeiter'))
  );

-- product_categories
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view product categories" ON product_categories
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Staff can manage product categories" ON product_categories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'mitarbeiter'))
  );

-- product_units
ALTER TABLE product_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view product units" ON product_units
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Staff can manage product units" ON product_units
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'mitarbeiter'))
  );

-- trades
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view trades" ON trades
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Staff can manage trades" ON trades
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'mitarbeiter'))
  );
