-- Termin-Reaktionen vom Kunden
CREATE TABLE IF NOT EXISTS appointment_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Entweder interner oder Partner-Termin
  appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
  partner_appointment_id UUID REFERENCES partner_job_appointments(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  response_type TEXT NOT NULL CHECK (response_type IN ('reschedule', 'time_change', 'comment', 'decline')),
  proposed_date DATE,
  proposed_time_start TIME,
  proposed_time_end TIME,
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id),
  
  -- Mindestens einer muss gesetzt sein
  CONSTRAINT appointment_ref_check CHECK (
    appointment_id IS NOT NULL OR partner_appointment_id IS NOT NULL
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_appointment_responses_customer ON appointment_responses(customer_id);
CREATE INDEX IF NOT EXISTS idx_appointment_responses_status ON appointment_responses(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_appointment_responses_appointment ON appointment_responses(appointment_id) WHERE appointment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_appointment_responses_partner_appt ON appointment_responses(partner_appointment_id) WHERE partner_appointment_id IS NOT NULL;

-- RLS
ALTER TABLE appointment_responses ENABLE ROW LEVEL SECURITY;

-- Kunden können eigene Reaktionen erstellen und sehen
CREATE POLICY "Customers can create responses" ON appointment_responses
  FOR INSERT WITH CHECK (
    customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "Customers can view own responses" ON appointment_responses
  FOR SELECT USING (
    customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid())
  );

-- Interne User können alle sehen und bearbeiten
CREATE POLICY "Internal users full access" ON appointment_responses
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'mitarbeiter'))
  );

-- Partner können Reaktionen auf ihre Termine sehen
CREATE POLICY "Partners can view responses for their appointments" ON appointment_responses
  FOR SELECT USING (
    partner_appointment_id IN (
      SELECT pja.id FROM partner_job_appointments pja
      JOIN partner_jobs pj ON pja.job_id = pj.id
      WHERE pj.accepted_by_partner_id IN (
        SELECT partner_id FROM partner_users WHERE auth_user_id = auth.uid()
      )
    )
  );

-- Partner können Status aktualisieren
CREATE POLICY "Partners can update response status" ON appointment_responses
  FOR UPDATE USING (
    partner_appointment_id IN (
      SELECT pja.id FROM partner_job_appointments pja
      JOIN partner_jobs pj ON pja.job_id = pj.id
      WHERE pj.accepted_by_partner_id IN (
        SELECT partner_id FROM partner_users WHERE auth_user_id = auth.uid()
      )
    )
  );
