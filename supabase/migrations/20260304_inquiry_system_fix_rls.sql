-- Fix RLS policies for inquiry system tables
-- Run this if "permission denied" errors occur

-- Drop existing policies (if they exist)
DROP POLICY IF EXISTS "inquiry_templates_all_auth" ON inquiry_templates;
DROP POLICY IF EXISTS "inquiries_all_auth" ON inquiries;
DROP POLICY IF EXISTS "inquiry_recipients_all_auth" ON inquiry_recipients;
DROP POLICY IF EXISTS "inquiry_responses_all_auth" ON inquiry_responses;
DROP POLICY IF EXISTS "inquiry_messages_all_auth" ON inquiry_messages;

-- Ensure RLS is enabled
ALTER TABLE inquiry_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiry_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiry_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquiry_messages ENABLE ROW LEVEL SECURITY;

-- Recreate permissive policies
CREATE POLICY "inquiry_templates_all_auth" ON inquiry_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "inquiries_all_auth" ON inquiries FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "inquiry_recipients_all_auth" ON inquiry_recipients FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "inquiry_responses_all_auth" ON inquiry_responses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "inquiry_messages_all_auth" ON inquiry_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);
