-- Enable RLS on wawi_quotes and wawi_quote_items
-- Security: Restrict access to admin/mitarbeiter only

-- wawi_quotes
ALTER TABLE wawi_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view all quotes" ON wawi_quotes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'mitarbeiter'))
  );

CREATE POLICY "Staff can create quotes" ON wawi_quotes
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'mitarbeiter'))
  );

CREATE POLICY "Staff can update quotes" ON wawi_quotes
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'mitarbeiter'))
  );

CREATE POLICY "Staff can delete quotes" ON wawi_quotes
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'mitarbeiter'))
  );

-- wawi_quote_items
ALTER TABLE wawi_quote_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view all quote items" ON wawi_quote_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'mitarbeiter'))
  );

CREATE POLICY "Staff can create quote items" ON wawi_quote_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'mitarbeiter'))
  );

CREATE POLICY "Staff can update quote items" ON wawi_quote_items
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'mitarbeiter'))
  );

CREATE POLICY "Staff can delete quote items" ON wawi_quote_items
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'mitarbeiter'))
  );
