-- Enable RLS on job_diary_entries
-- Security: Restrict access to partners' own diary entries

ALTER TABLE job_diary_entries ENABLE ROW LEVEL SECURITY;

-- Partners can view own diary entries
CREATE POLICY "Partners can view own diary entries" ON job_diary_entries
  FOR SELECT USING (
    partner_user_id IN (SELECT id FROM partner_users WHERE auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'mitarbeiter'))
  );

-- Partners can create own diary entries
CREATE POLICY "Partners can create own diary entries" ON job_diary_entries
  FOR INSERT WITH CHECK (
    partner_user_id IN (SELECT id FROM partner_users WHERE auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'mitarbeiter'))
  );

-- Partners can update own diary entries
CREATE POLICY "Partners can update own diary entries" ON job_diary_entries
  FOR UPDATE USING (
    partner_user_id IN (SELECT id FROM partner_users WHERE auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'mitarbeiter'))
  );

-- Partners can delete own diary entries
CREATE POLICY "Partners can delete own diary entries" ON job_diary_entries
  FOR DELETE USING (
    partner_user_id IN (SELECT id FROM partner_users WHERE auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role IN ('admin', 'mitarbeiter'))
  );
