-- Create audit_logs table for security and compliance tracking
-- Tracks all critical operations: logins, data changes, permission changes, etc.

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who performed the action
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  user_role TEXT,

  -- What action was performed
  action TEXT NOT NULL, -- e.g., 'login', 'create_user', 'delete_document', 'update_project'
  resource_type TEXT, -- e.g., 'user', 'project', 'document'
  resource_id UUID,

  -- Action details
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb, -- Additional data (old values, new values, etc.)

  -- Request context
  ip_address TEXT,
  user_agent TEXT,
  request_id TEXT,

  -- Result
  status TEXT NOT NULL DEFAULT 'success', -- 'success', 'failure', 'error'
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for fast querying
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_status ON audit_logs(status);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Only admins can view audit logs" ON audit_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- System can insert audit logs (no RLS on INSERT for service role)
CREATE POLICY "System can insert audit logs" ON audit_logs
  FOR INSERT WITH CHECK (true);

-- Nobody can update or delete audit logs (immutable)
-- (This ensures audit log integrity)

-- Grant permissions
GRANT SELECT ON audit_logs TO authenticated;
GRANT INSERT ON audit_logs TO authenticated, service_role;

-- Add comment
COMMENT ON TABLE audit_logs IS 'Security audit trail for compliance and forensics';
