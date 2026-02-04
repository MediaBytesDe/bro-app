-- Add package price columns to wawi_quotes
ALTER TABLE wawi_quotes ADD COLUMN IF NOT EXISTS package_price DECIMAL(12,2) DEFAULT NULL;
ALTER TABLE wawi_quotes ADD COLUMN IF NOT EXISTS package_surcharge DECIMAL(12,2) DEFAULT NULL;
