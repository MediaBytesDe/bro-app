-- Quote Template Categories
CREATE TABLE IF NOT EXISTS quote_template_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#f97316',
  sort_order INTEGER DEFAULT 0
);

-- Default Kategorien einfügen
INSERT INTO quote_template_categories (name, slug, color, sort_order) VALUES
  ('Photovoltaik', 'pv', '#f97316', 0),
  ('Wallbox', 'wallbox', '#3b82f6', 1),
  ('Speicher', 'speicher', '#22c55e', 2),
  ('Dienstleistung', 'service', '#8b5cf6', 3)
ON CONFLICT (slug) DO NOTHING;

-- RLS
ALTER TABLE quote_template_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read categories" ON quote_template_categories
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage categories" ON quote_template_categories
  FOR ALL USING (auth.role() = 'authenticated');
