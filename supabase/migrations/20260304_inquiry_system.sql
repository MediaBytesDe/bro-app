-- ============================================
-- INQUIRY SYSTEM (Anfragen-System)
-- Created: 2026-03-04
-- ============================================

-- Templates: Admin-managed checklists per trade
CREATE TABLE IF NOT EXISTS inquiry_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade text NOT NULL,
  name text NOT NULL,
  description text,
  fields jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Inquiries: The actual requests
CREATE TABLE IF NOT EXISTS inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  template_id uuid REFERENCES inquiry_templates(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  trade text NOT NULL,
  urgency text DEFAULT 'normal',
  location_notes text,
  checklist_data jsonb DEFAULT '{}'::jsonb,
  photos jsonb DEFAULT '[]'::jsonb,
  status text DEFAULT 'draft',
  mode text DEFAULT 'direct',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Recipients: Which partners received the inquiry
CREATE TABLE IF NOT EXISTS inquiry_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id uuid NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  status text DEFAULT 'pending',
  viewed_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(inquiry_id, partner_id)
);

-- Responses: Partner answers with pricing
CREATE TABLE IF NOT EXISTS inquiry_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id uuid NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  response_type text DEFAULT 'quick',
  quick_text text,
  quick_price numeric,
  quick_timeframe text,
  positions jsonb DEFAULT '[]'::jsonb,
  total_amount numeric,
  notes text,
  valid_until date,
  status text DEFAULT 'draft',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(inquiry_id, partner_id)
);

-- Messages: Threaded conversation per inquiry
CREATE TABLE IF NOT EXISTS inquiry_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id uuid NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  sender_type text NOT NULL,
  sender_id uuid NOT NULL,
  sender_name text NOT NULL,
  message text NOT NULL,
  attachments jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  read_at timestamptz
);

-- ============================================
-- RLS
-- ============================================

ALTER TABLE inquiry_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiry_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiry_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiry_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inquiry_templates_all_auth" ON inquiry_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "inquiries_all_auth" ON inquiries FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "inquiry_recipients_all_auth" ON inquiry_recipients FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "inquiry_responses_all_auth" ON inquiry_responses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "inquiry_messages_all_auth" ON inquiry_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- INDEXES
-- ============================================

-- inquiry_templates
CREATE INDEX IF NOT EXISTS idx_inquiry_templates_trade ON inquiry_templates(trade);
CREATE INDEX IF NOT EXISTS idx_inquiry_templates_is_active ON inquiry_templates(is_active);

-- inquiries
CREATE INDEX IF NOT EXISTS idx_inquiries_project_id ON inquiries(project_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_template_id ON inquiries(template_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_trade ON inquiries(trade);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);
CREATE INDEX IF NOT EXISTS idx_inquiries_created_by ON inquiries(created_by);
CREATE INDEX IF NOT EXISTS idx_inquiries_created_at ON inquiries(created_at);

-- inquiry_recipients
CREATE INDEX IF NOT EXISTS idx_inquiry_recipients_inquiry_id ON inquiry_recipients(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_inquiry_recipients_partner_id ON inquiry_recipients(partner_id);
CREATE INDEX IF NOT EXISTS idx_inquiry_recipients_status ON inquiry_recipients(status);

-- inquiry_responses
CREATE INDEX IF NOT EXISTS idx_inquiry_responses_inquiry_id ON inquiry_responses(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_inquiry_responses_partner_id ON inquiry_responses(partner_id);
CREATE INDEX IF NOT EXISTS idx_inquiry_responses_status ON inquiry_responses(status);

-- inquiry_messages
CREATE INDEX IF NOT EXISTS idx_inquiry_messages_inquiry_id ON inquiry_messages(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_inquiry_messages_created_at ON inquiry_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_inquiry_messages_sender_id ON inquiry_messages(sender_id);

-- ============================================
-- TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS update_inquiry_templates_updated_at ON inquiry_templates;
CREATE TRIGGER update_inquiry_templates_updated_at BEFORE UPDATE ON inquiry_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_inquiries_updated_at ON inquiries;
CREATE TRIGGER update_inquiries_updated_at BEFORE UPDATE ON inquiries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_inquiry_responses_updated_at ON inquiry_responses;
CREATE TRIGGER update_inquiry_responses_updated_at BEFORE UPDATE ON inquiry_responses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
