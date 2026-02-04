-- Allow partners to insert counter-proposals into appointment_responses
-- They can only insert for appointments belonging to their jobs

-- First ensure RLS is enabled
ALTER TABLE appointment_responses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Partners can insert counter proposals" ON appointment_responses;

-- Partners can insert responses (counter-proposals) for appointments they own
CREATE POLICY "Partners can insert counter proposals" ON appointment_responses
FOR INSERT TO authenticated
WITH CHECK (
  -- The appointment must belong to a job that the partner owns
  partner_appointment_id IN (
    SELECT pja.id FROM partner_job_appointments pja
    JOIN partner_jobs pj ON pja.job_id = pj.id
    WHERE pj.accepted_by_partner_id IN (
      SELECT partner_id FROM partner_users 
      WHERE auth_user_id = auth.uid()
    )
  )
);

-- Also need SELECT policy for partners to see counter-proposals
DROP POLICY IF EXISTS "Partners can view responses for their appointments" ON appointment_responses;
CREATE POLICY "Partners can view responses for their appointments" ON appointment_responses
FOR SELECT TO authenticated
USING (
  partner_appointment_id IN (
    SELECT pja.id FROM partner_job_appointments pja
    JOIN partner_jobs pj ON pja.job_id = pj.id
    WHERE pj.accepted_by_partner_id IN (
      SELECT partner_id FROM partner_users 
      WHERE auth_user_id = auth.uid()
    )
  )
  OR
  customer_id IN (
    SELECT id FROM customers WHERE auth_user_id = auth.uid()
  )
);

-- Partners can update responses (change status)
DROP POLICY IF EXISTS "Partners can update responses" ON appointment_responses;
CREATE POLICY "Partners can update responses" ON appointment_responses
FOR UPDATE TO authenticated
USING (
  partner_appointment_id IN (
    SELECT pja.id FROM partner_job_appointments pja
    JOIN partner_jobs pj ON pja.job_id = pj.id
    WHERE pj.accepted_by_partner_id IN (
      SELECT partner_id FROM partner_users 
      WHERE auth_user_id = auth.uid()
    )
  )
);

-- Customers can insert their own responses
DROP POLICY IF EXISTS "Customers can insert responses" ON appointment_responses;
CREATE POLICY "Customers can insert responses" ON appointment_responses
FOR INSERT TO authenticated
WITH CHECK (
  customer_id IN (
    SELECT id FROM customers WHERE auth_user_id = auth.uid()
  )
);

-- Customers can update counter-proposal status (accept/reject)
DROP POLICY IF EXISTS "Customers can update counter proposals" ON appointment_responses;
CREATE POLICY "Customers can update counter proposals" ON appointment_responses
FOR UPDATE TO authenticated
USING (
  customer_id IN (
    SELECT id FROM customers WHERE auth_user_id = auth.uid()
  )
);
