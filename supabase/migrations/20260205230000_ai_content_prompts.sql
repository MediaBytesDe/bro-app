-- AI Content Prompts Table
CREATE TABLE IF NOT EXISTS ai_content_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain VARCHAR(100) NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL,
  user_prompt_template TEXT NOT NULL,
  placeholder_fields JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for domain lookups
CREATE INDEX idx_ai_prompts_domain ON ai_content_prompts(domain, is_active);

-- RLS Policies
ALTER TABLE ai_content_prompts ENABLE ROW LEVEL SECURITY;

-- Everyone can view active prompts
CREATE POLICY "Users can view active prompts"
  ON ai_content_prompts
  FOR SELECT
  USING (
    is_active = true
    OR
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Only admins can insert
CREATE POLICY "Admins can insert prompts"
  ON ai_content_prompts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Only admins can update
CREATE POLICY "Admins can update prompts"
  ON ai_content_prompts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Only admins can delete
CREATE POLICY "Admins can delete prompts"
  ON ai_content_prompts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Grant permissions
GRANT ALL ON ai_content_prompts TO authenticated;

-- Add comments
COMMENT ON TABLE ai_content_prompts IS 'AI content generation prompt templates for different domains';
COMMENT ON COLUMN ai_content_prompts.domain IS 'Domain identifier (e.g., product_description, email_customer)';
COMMENT ON COLUMN ai_content_prompts.system_prompt IS 'System prompt for AI agent role';
COMMENT ON COLUMN ai_content_prompts.user_prompt_template IS 'User prompt template with {{placeholder}} variables';
COMMENT ON COLUMN ai_content_prompts.placeholder_fields IS 'Array of placeholder field names expected in context';

-- Insert default prompts
INSERT INTO ai_content_prompts (domain, name, description, system_prompt, user_prompt_template, placeholder_fields, sort_order) VALUES
(
  'product_description',
  'Produktbeschreibung (Marketing)',
  'Verkaufsfördernde Produktbeschreibung für Marketing-Zwecke',
  'Du bist ein Marketing-Experte für Solar-Produkte. Schreibe verkaufsfördernde, präzise Produktbeschreibungen. Halte dich an diese Regeln:
- Maximal 200 Wörter
- Fokus auf Nutzen, nicht nur Features
- Technische Daten einbeziehen wenn vorhanden
- Verkaufsfördernde aber ehrliche Sprache
- Deutsche Sprache',
  'Erstelle eine Produktbeschreibung für:

Name: {{productName}}
Kategorie: {{category}}
{{#manufacturer}}Hersteller: {{manufacturer}}{{/manufacturer}}

{{#currentValue}}Aktueller Text: {{currentValue}}{{/currentValue}}

{{#userInstructions}}Zusätzliche Anweisungen: {{userInstructions}}{{/userInstructions}}',
  '["productName", "category", "manufacturer", "currentValue", "userInstructions"]'::jsonb,
  0
),
(
  'product_description',
  'Produktbeschreibung (Technisch)',
  'Technische Produktbeschreibung mit Details',
  'Du bist ein technischer Redakteur für Solar-Produkte. Schreibe präzise technische Beschreibungen. Halte dich an diese Regeln:
- Maximal 300 Wörter
- Fokus auf technische Spezifikationen
- Objektive, sachliche Sprache
- Keine Marketing-Floskeln
- Deutsche Sprache',
  'Erstelle eine technische Produktbeschreibung für:

Name: {{productName}}
Kategorie: {{category}}
{{#manufacturer}}Hersteller: {{manufacturer}}{{/manufacturer}}

{{#currentValue}}Aktueller Text: {{currentValue}}{{/currentValue}}

{{#userInstructions}}Zusätzliche Anweisungen: {{userInstructions}}{{/userInstructions}}',
  '["productName", "category", "manufacturer", "currentValue", "userInstructions"]'::jsonb,
  1
);
