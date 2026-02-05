-- Performance Optimization: Add missing indexes
-- Date: 2026-02-05

-- Customers table
CREATE INDEX IF NOT EXISTS idx_customers_auth_user_id ON customers(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_customers_active ON customers(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at DESC);

-- Projects table
CREATE INDEX IF NOT EXISTS idx_projects_customer_id ON projects(customer_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at DESC);

-- Messages table (for chat functionality)
CREATE INDEX IF NOT EXISTS idx_messages_project_id ON messages(project_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_type ON messages(sender_type);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_visible_to_customer ON messages(visible_to_customer)
  WHERE visible_to_customer = true;

-- Documents table
CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_customer_id ON documents(customer_id);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);

-- Appointments table
CREATE INDEX IF NOT EXISTS idx_appointments_customer_id ON appointments(customer_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

-- Tasks table
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);

-- Quotes table
CREATE INDEX IF NOT EXISTS idx_wawi_quotes_customer_id ON wawi_quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_wawi_quotes_status ON wawi_quotes(status);
CREATE INDEX IF NOT EXISTS idx_wawi_quotes_created_at ON wawi_quotes(created_at DESC);

-- Leads table
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);

-- Partner assignments
CREATE INDEX IF NOT EXISTS idx_project_partners_project_id ON project_partners(project_id);
CREATE INDEX IF NOT EXISTS idx_project_partners_partner_id ON project_partners(partner_id);

-- Job diary entries
CREATE INDEX IF NOT EXISTS idx_job_diary_project_id ON job_diary_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_job_diary_partner_user ON job_diary_entries(partner_user_id);
CREATE INDEX IF NOT EXISTS idx_job_diary_date ON job_diary_entries(work_date DESC);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_projects_customer_status
  ON projects(customer_id, status);

CREATE INDEX IF NOT EXISTS idx_messages_project_visible
  ON messages(project_id, visible_to_customer)
  WHERE visible_to_customer = true;

CREATE INDEX IF NOT EXISTS idx_appointments_customer_date
  ON appointments(customer_id, appointment_date);

-- Add comments
COMMENT ON INDEX idx_customers_auth_user_id IS 'Optimize user profile lookups';
COMMENT ON INDEX idx_projects_customer_status IS 'Optimize project filtering by customer and status';
COMMENT ON INDEX idx_messages_project_visible IS 'Optimize customer message queries';
