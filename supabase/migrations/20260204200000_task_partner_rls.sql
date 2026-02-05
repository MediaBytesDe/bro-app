-- Migration: Task Partner RLS
-- Ermöglicht Partnern Zugriff auf ihre zugewiesenen Tasks

-- 1. Spalte hinzufügen
ALTER TABLE project_tasks 
  ADD COLUMN IF NOT EXISTS assigned_partner_id UUID REFERENCES partners(id) ON DELETE SET NULL;

-- 2. RLS aktivieren (falls nicht aktiv)
ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;

-- 3. Policy für interne User (admin, mitarbeiter)
DROP POLICY IF EXISTS "Internal users full access to tasks" ON project_tasks;
CREATE POLICY "Internal users full access to tasks" ON project_tasks
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.auth_id = auth.uid() 
      AND users.role IN ('admin', 'mitarbeiter')
    )
  );

-- 4. Policy für Partner: Lesen
DROP POLICY IF EXISTS "Partners can view assigned tasks" ON project_tasks;
CREATE POLICY "Partners can view assigned tasks" ON project_tasks
  FOR SELECT
  USING (
    assigned_partner_id IN (
      SELECT partner_id FROM partner_users WHERE user_id = auth.uid()
    )
  );

-- 5. Policy für Partner: Updaten (Status ändern)
DROP POLICY IF EXISTS "Partners can update assigned tasks" ON project_tasks;
CREATE POLICY "Partners can update assigned tasks" ON project_tasks
  FOR UPDATE
  USING (
    assigned_partner_id IN (
      SELECT partner_id FROM partner_users WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    assigned_partner_id IN (
      SELECT partner_id FROM partner_users WHERE user_id = auth.uid()
    )
  );

-- 6. Grants
GRANT ALL ON project_tasks TO authenticated, service_role;
