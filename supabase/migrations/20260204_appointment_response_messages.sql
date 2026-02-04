-- Nachrichten zu Termin-Anfragen (Konversation)
CREATE TABLE IF NOT EXISTS appointment_response_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID NOT NULL REFERENCES appointment_responses(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'partner', 'internal')),
  sender_id UUID NOT NULL,
  sender_name TEXT,
  message TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_response_messages_response ON appointment_response_messages(response_id);
CREATE INDEX idx_response_messages_created ON appointment_response_messages(created_at);

-- read_at auf der Hauptanfrage
ALTER TABLE appointment_responses ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
ALTER TABLE appointment_responses ADD COLUMN IF NOT EXISTS read_by_type TEXT;

-- RLS
ALTER TABLE appointment_response_messages ENABLE ROW LEVEL SECURITY;

-- Kunden können Nachrichten zu eigenen Anfragen sehen und schreiben
CREATE POLICY "Customers can view messages" ON appointment_response_messages
  FOR SELECT USING (
    response_id IN (
      SELECT id FROM appointment_responses WHERE customer_id IN (
        SELECT id FROM customers WHERE auth_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Customers can create messages" ON appointment_response_messages
  FOR INSERT WITH CHECK (
    sender_type = 'customer' AND
    response_id IN (
      SELECT id FROM appointment_responses WHERE customer_id IN (
        SELECT id FROM customers WHERE auth_user_id = auth.uid()
      )
    )
  );

-- Partner können Nachrichten zu ihren Terminen sehen und schreiben
CREATE POLICY "Partners can view messages" ON appointment_response_messages
  FOR SELECT USING (
    response_id IN (
      SELECT ar.id FROM appointment_responses ar
      WHERE ar.partner_appointment_id IN (
        SELECT pja.id FROM partner_job_appointments pja
        JOIN partner_jobs pj ON pja.job_id = pj.id
        WHERE pj.accepted_by_partner_id IN (
          SELECT partner_id FROM partner_users WHERE auth_user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Partners can create messages" ON appointment_response_messages
  FOR INSERT WITH CHECK (
    sender_type = 'partner' AND
    response_id IN (
      SELECT ar.id FROM appointment_responses ar
      WHERE ar.partner_appointment_id IN (
        SELECT pja.id FROM partner_job_appointments pja
        JOIN partner_jobs pj ON pja.job_id = pj.id
        WHERE pj.accepted_by_partner_id IN (
          SELECT partner_id FROM partner_users WHERE auth_user_id = auth.uid()
        )
      )
    )
  );

-- Interne User Vollzugriff
CREATE POLICY "Internal users full access messages" ON appointment_response_messages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'mitarbeiter'))
  );

-- GRANTs
GRANT ALL ON appointment_response_messages TO authenticated;
GRANT ALL ON appointment_response_messages TO anon;
