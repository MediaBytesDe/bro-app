-- Migration: Create standalone tasks table
-- Allows creating tasks outside of projects

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'blocked', 'done', 'completed')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),

  -- Assignment
  assigned_to UUID REFERENCES users(auth_id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(auth_id) ON DELETE SET NULL,

  -- Dates
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Optional project link (tasks CAN be linked to projects, but don't have to be)
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,

  -- Metadata
  tags TEXT[],
  attachments JSONB DEFAULT '[]'::jsonb
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);

-- RLS Policies
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all tasks
CREATE POLICY "Users can read all tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to create tasks
CREATE POLICY "Users can create tasks"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
      AND users.role IN ('admin', 'mitarbeiter', 'superadmin')
    )
  );

-- Allow users to update their own tasks or tasks they created
CREATE POLICY "Users can update their tasks"
  ON tasks FOR UPDATE
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
      AND users.role IN ('admin', 'superadmin')
    )
  );

-- Allow admins and task creators to delete tasks
CREATE POLICY "Users can delete their tasks"
  ON tasks FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
      AND users.role IN ('admin', 'superadmin')
    )
  );

-- Grant permissions
GRANT ALL ON tasks TO authenticated, service_role;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();

  -- Set completed_at when status changes to completed or done
  IF NEW.status IN ('completed', 'done') AND OLD.status NOT IN ('completed', 'done') THEN
    NEW.completed_at = NOW();
  END IF;

  -- Clear completed_at if status changes away from completed/done
  IF NEW.status NOT IN ('completed', 'done') AND OLD.status IN ('completed', 'done') THEN
    NEW.completed_at = NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_tasks_updated_at();

-- Add comment for documentation
COMMENT ON TABLE tasks IS 'Standalone tasks table for tasks not tied to specific projects';
COMMENT ON COLUMN tasks.assigned_to IS 'User this task is assigned to (references users.auth_id)';
COMMENT ON COLUMN tasks.project_id IS 'Optional project link - tasks can exist without a project';
