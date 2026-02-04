-- Add trades array to partners table
ALTER TABLE partners ADD COLUMN IF NOT EXISTS trades TEXT[] DEFAULT '{}';

-- Migrate existing trade to trades array
UPDATE partners SET trades = ARRAY[trade] WHERE trade IS NOT NULL AND (trades IS NULL OR trades = '{}');

-- Create index for trade filtering
CREATE INDEX IF NOT EXISTS idx_partners_trades ON partners USING GIN(trades);
