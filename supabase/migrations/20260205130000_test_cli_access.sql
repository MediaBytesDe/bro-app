-- Test migration to verify CLI access works
-- This adds a comment to verify automatic migration deployment

COMMENT ON TABLE messages IS 'Project communication messages - supports customer, partner, and internal communication';
