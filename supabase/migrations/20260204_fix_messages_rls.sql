-- Fix: appointment_response_messages RLS für Kunden

-- Alte Policies droppen (falls kaputt)
DROP POLICY IF EXISTS "Customers can view messages" ON appointment_response_messages;
DROP POLICY IF EXISTS "Customers can create messages" ON appointment_response_messages;
DROP POLICY IF EXISTS "Partners can view messages" ON appointment_response_messages;
DROP POLICY IF EXISTS "Partners can create messages" ON appointment_response_messages;
DROP POLICY IF EXISTS "Internal users full access messages" ON appointment_response_messages;

-- RLS sicherstellen
ALTER TABLE appointment_response_messages ENABLE ROW LEVEL SECURITY;

-- Neu: Kunden können ALLE Nachrichten ihrer Anfragen sehen (inkl. Partner-Antworten)
CREATE POLICY "customer_view_messages" ON appointment_response_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM appointment_responses ar
      JOIN customers c ON ar.customer_id = c.id
      WHERE ar.id = response_id AND c.auth_user_id = auth.uid()
    )
  );

-- Kunden können eigene Nachrichten erstellen
CREATE POLICY "customer_create_messages" ON appointment_response_messages
  FOR INSERT WITH CHECK (
    sender_type = 'customer' AND
    EXISTS (
      SELECT 1 FROM appointment_responses ar
      JOIN customers c ON ar.customer_id = c.id
      WHERE ar.id = response_id AND c.auth_user_id = auth.uid()
    )
  );

-- Partner können Nachrichten ihrer Termine sehen
CREATE POLICY "partner_view_messages" ON appointment_response_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM appointment_responses ar
      JOIN partner_job_appointments pja ON ar.partner_appointment_id = pja.id
      JOIN partner_jobs pj ON pja.job_id = pj.id
      JOIN partner_users pu ON pj.accepted_by_partner_id = pu.partner_id
      WHERE ar.id = response_id AND pu.auth_user_id = auth.uid()
    )
  );

-- Partner können Nachrichten erstellen
CREATE POLICY "partner_create_messages" ON appointment_response_messages
  FOR INSERT WITH CHECK (
    sender_type = 'partner' AND
    EXISTS (
      SELECT 1 FROM appointment_responses ar
      JOIN partner_job_appointments pja ON ar.partner_appointment_id = pja.id
      JOIN partner_jobs pj ON pja.job_id = pj.id
      JOIN partner_users pu ON pj.accepted_by_partner_id = pu.partner_id
      WHERE ar.id = response_id AND pu.auth_user_id = auth.uid()
    )
  );

-- Interne User
CREATE POLICY "internal_full_access_messages" ON appointment_response_messages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'mitarbeiter'))
  );

-- GRANTs
GRANT ALL ON appointment_response_messages TO authenticated;
GRANT SELECT ON appointment_response_messages TO anon;
