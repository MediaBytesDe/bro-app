-- Add UPDATE policy for messages table to allow marking messages as read

-- Messages: Participants can update messages (specifically for read_by field)
CREATE POLICY "Participants can update message read status" ON messages
  FOR UPDATE USING (
    -- Customer can update messages in their own projects
    project_id IN (
      SELECT id FROM projects WHERE customer_id IN (
        SELECT id FROM customers WHERE auth_user_id = auth.uid()
      )
    )
    OR
    -- Partner can update messages in assigned projects
    project_id IN (
      SELECT project_id FROM partner_jobs
      WHERE accepted_by_partner_id IN (
        SELECT partner_id FROM partner_users WHERE auth_user_id = auth.uid()
      )
    )
    OR
    -- BROjekt staff can update all messages
    EXISTS (
      SELECT 1 FROM users WHERE auth_id = auth.uid()
      AND role IN ('admin', 'mitarbeiter')
    )
  );
