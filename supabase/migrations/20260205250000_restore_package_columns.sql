-- Restore missing package columns to wawi_quotes
-- These were lost when table was recreated

ALTER TABLE wawi_quotes
ADD COLUMN IF NOT EXISTS package_title TEXT,
ADD COLUMN IF NOT EXISTS package_price DECIMAL(12,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS package_surcharge DECIMAL(12,2) DEFAULT NULL;
