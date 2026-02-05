-- Enable Realtime replication for messages table
-- This allows frontend to receive live updates via Supabase Realtime subscriptions

-- Set REPLICA IDENTITY to FULL so all column values are included in realtime events
ALTER TABLE messages REPLICA IDENTITY FULL;

-- Add table to Supabase Realtime publication
-- This makes INSERT/UPDATE/DELETE events available to subscribers
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
