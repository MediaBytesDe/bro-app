-- Fix all RLS policies that incorrectly reference 'profiles' table instead of 'users'
-- Root cause: partner_portal migration used wrong table name for BROjekt admin checks

-- ============================================
-- PARTNERS POLICIES
-- ============================================

DROP POLICY IF EXISTS "Partner users can view own partner" ON partners;
CREATE POLICY "Partner users can view own partner" ON partners
  FOR SELECT USING (
    id IN (SELECT partner_id FROM partner_users WHERE auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Partner users can update own partner" ON partners;
CREATE POLICY "Partner users can update own partner" ON partners
  FOR UPDATE USING (
    id IN (SELECT partner_id FROM partner_users WHERE auth_user_id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- PARTNER_USERS POLICIES
-- ============================================

DROP POLICY IF EXISTS "Partner users can view team members" ON partner_users;
CREATE POLICY "Partner users can view team members" ON partner_users
  FOR SELECT USING (
    partner_id IN (SELECT partner_id FROM partner_users WHERE auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Partner admins can update team" ON partner_users;
CREATE POLICY "Partner admins can update team" ON partner_users
  FOR UPDATE USING (
    partner_id IN (SELECT partner_id FROM partner_users WHERE auth_user_id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Partner admins can create team members" ON partner_users;
CREATE POLICY "Partner admins can create team members" ON partner_users
  FOR INSERT WITH CHECK (
    partner_id IN (SELECT partner_id FROM partner_users WHERE auth_user_id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Partner admins can delete team members" ON partner_users;
CREATE POLICY "Partner admins can delete team members" ON partner_users
  FOR DELETE USING (
    partner_id IN (SELECT partner_id FROM partner_users WHERE auth_user_id = auth.uid() AND role = 'admin')
    OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- PARTNER_JOBS POLICIES
-- ============================================

DROP POLICY IF EXISTS "Partners can view assigned jobs" ON partner_jobs;
CREATE POLICY "Partners can view assigned jobs" ON partner_jobs
  FOR SELECT USING (
    accepted_by_partner_id IN (SELECT partner_id FROM partner_users WHERE auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Partners can update jobs" ON partner_jobs;
CREATE POLICY "Partners can update jobs" ON partner_jobs
  FOR UPDATE USING (
    accepted_by_partner_id IN (SELECT partner_id FROM partner_users WHERE auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- JOB_REPORTS POLICIES
-- ============================================

DROP POLICY IF EXISTS "Partners can view own reports" ON job_reports;
CREATE POLICY "Partners can view own reports" ON job_reports
  FOR SELECT USING (
    partner_user_id IN (SELECT id FROM partner_users WHERE auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'user'))
  );

DROP POLICY IF EXISTS "Partners can create reports" ON job_reports;
CREATE POLICY "Partners can create reports" ON job_reports
  FOR INSERT WITH CHECK (
    partner_user_id IN (SELECT id FROM partner_users WHERE auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'user'))
  );

-- ============================================
-- MESSAGES POLICIES (CRITICAL FIX)
-- ============================================

DROP POLICY IF EXISTS "Project participants can view messages" ON messages;
CREATE POLICY "Project participants can view messages" ON messages
  FOR SELECT USING (
    -- Kunde sieht eigene Projekte
    (visible_to_customer AND project_id IN (
      SELECT id FROM projects WHERE customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid())
    ))
    OR
    -- Partner sieht zugewiesene Projekte
    (visible_to_partners AND project_id IN (
      SELECT project_id FROM partner_jobs
      WHERE accepted_by_partner_id IN (SELECT partner_id FROM partner_users WHERE auth_user_id = auth.uid())
    ))
    OR
    -- BROjekt sieht alles (FIXED: users instead of profiles)
    EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'mitarbeiter'))
  );

DROP POLICY IF EXISTS "Participants can send messages" ON messages;
CREATE POLICY "Participants can send messages" ON messages
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid())
    )
    OR project_id IN (
      SELECT project_id FROM partner_jobs
      WHERE accepted_by_partner_id IN (SELECT partner_id FROM partner_users WHERE auth_user_id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'mitarbeiter'))
  );

-- UPDATE policy for marking messages as read
DROP POLICY IF EXISTS "Participants can update message read status" ON messages;
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
    -- BROjekt staff can update all messages (FIXED: users instead of profiles)
    EXISTS (
      SELECT 1 FROM users WHERE auth_id = auth.uid()
      AND role IN ('admin', 'mitarbeiter')
    )
  );

-- ============================================
-- NOTIFICATIONS POLICIES
-- ============================================

DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (
    (recipient_type = 'customer' AND recipient_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid()))
    OR (recipient_type = 'partner' AND recipient_id IN (SELECT id FROM partner_users WHERE auth_user_id = auth.uid()))
    OR (recipient_type = 'user' AND recipient_id IN (SELECT id FROM users WHERE auth_id = auth.uid()))
  );

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (
    (recipient_type = 'customer' AND recipient_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid()))
    OR (recipient_type = 'partner' AND recipient_id IN (SELECT id FROM partner_users WHERE auth_user_id = auth.uid()))
    OR (recipient_type = 'user' AND recipient_id IN (SELECT id FROM users WHERE auth_id = auth.uid()))
  );

-- ============================================
-- RE-ENABLE RLS (in case it was disabled during debugging)
-- ============================================

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
