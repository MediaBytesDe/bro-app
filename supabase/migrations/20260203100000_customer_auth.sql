-- Add auth_user_id to customers for linking to Supabase Auth
ALTER TABLE customers ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_customers_auth_user_id ON customers(auth_user_id);

-- Comment
COMMENT ON COLUMN customers.auth_user_id IS 'Links customer to Supabase Auth user for customer portal login';
