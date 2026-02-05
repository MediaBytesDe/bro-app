-- Migration: Task Partner FK
-- Ändert die FK-Beziehung von project_tasks.assigned_subcontractor_id 
-- von subcontractors auf partners

-- 1. Alte FK Constraint entfernen (falls vorhanden)
ALTER TABLE project_tasks 
  DROP CONSTRAINT IF EXISTS project_tasks_assigned_subcontractor_id_fkey;

-- 2. Spalte hinzufügen für Partner (parallel zur alten)
ALTER TABLE project_tasks 
  ADD COLUMN IF NOT EXISTS assigned_partner_id UUID REFERENCES partners(id) ON DELETE SET NULL;

-- 3. Grant permissions
GRANT ALL ON project_tasks TO authenticated, service_role;

-- Hinweis: assigned_subcontractor_id bleibt für Rückwärtskompatibilität,
-- aber wir nutzen jetzt assigned_partner_id für Partner-Zuweisungen
