-- OpenClaw Messages: Persistent storage for chat conversations
-- Created: 2026-02-05

-- Create openclaw_messages table
CREATE TABLE IF NOT EXISTS openclaw_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent TEXT NOT NULL CHECK (agent IN ('main', 'einkauf', 'kundenservice')),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indices for fast lookups
CREATE INDEX idx_openclaw_messages_agent_created
  ON openclaw_messages(agent, created_at DESC);

CREATE INDEX idx_openclaw_messages_user
  ON openclaw_messages(user_id);

CREATE INDEX idx_openclaw_messages_user_agent
  ON openclaw_messages(user_id, agent, created_at DESC);

-- Enable RLS
ALTER TABLE openclaw_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own messages
CREATE POLICY "Users can view own messages"
  ON openclaw_messages
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR
    -- Admin/Mitarbeiter can see all messages
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_id = auth.uid()
      AND role IN ('admin', 'mitarbeiter')
    )
  );

-- Policy: Users can insert their own messages
CREATE POLICY "Users can insert own messages"
  ON openclaw_messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND
    -- Only authenticated users with valid role (admin or mitarbeiter)
    EXISTS (
      SELECT 1 FROM users
      WHERE auth_id = auth.uid()
      AND role IN ('admin', 'mitarbeiter')
    )
  );

-- Grant permissions
GRANT ALL ON openclaw_messages TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE openclaw_messages IS 'Persistent storage for OpenClaw agent chat conversations';
COMMENT ON COLUMN openclaw_messages.agent IS 'Agent identifier: main (Bro), einkauf (Purchasing), kundenservice (Customer Service)';
COMMENT ON COLUMN openclaw_messages.role IS 'Message sender: user or assistant';
COMMENT ON COLUMN openclaw_messages.content IS 'Message text content';
COMMENT ON COLUMN openclaw_messages.user_id IS 'User who sent/received the message';
COMMENT ON COLUMN openclaw_messages.created_at IS 'Message timestamp';
