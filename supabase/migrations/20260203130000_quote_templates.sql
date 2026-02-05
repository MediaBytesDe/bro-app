-- Quote Templates Table
CREATE TABLE IF NOT EXISTS quote_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  
  items JSONB DEFAULT '[]'::jsonb,
  
  introduction_text TEXT,
  footer_text TEXT,
  
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0
);

-- Index für aktive Templates
CREATE INDEX IF NOT EXISTS idx_quote_templates_active ON quote_templates(is_active) WHERE is_active = true;

-- RLS Policies
ALTER TABLE quote_templates ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read active templates
CREATE POLICY "Users can read active templates" ON quote_templates
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow authenticated users to manage templates
CREATE POLICY "Users can manage templates" ON quote_templates
  FOR ALL USING (auth.role() = 'authenticated');

-- Trigger für updated_at
CREATE OR REPLACE FUNCTION update_quote_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quote_templates_updated_at
  BEFORE UPDATE ON quote_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_quote_templates_updated_at();
