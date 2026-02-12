-- Add status tracking timestamps to wawi_quotes
ALTER TABLE wawi_quotes ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE wawi_quotes ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMPTZ;
ALTER TABLE wawi_quotes ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
ALTER TABLE wawi_quotes ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

-- Backfill: set sent_at for already exported quotes
UPDATE wawi_quotes 
SET sent_at = updated_at 
WHERE lexware_quotation_id IS NOT NULL 
  AND sent_at IS NULL 
  AND status IN ('sent', 'sent_to_lexware', 'open', 'accepted', 'rejected');

-- Backfill: set accepted_at for accepted quotes
UPDATE wawi_quotes 
SET accepted_at = updated_at 
WHERE status = 'accepted' AND accepted_at IS NULL;

-- Backfill: set rejected_at for rejected quotes
UPDATE wawi_quotes 
SET rejected_at = updated_at 
WHERE status = 'rejected' AND rejected_at IS NULL;

-- Index for efficient status queries
CREATE INDEX IF NOT EXISTS idx_wawi_quotes_status ON wawi_quotes(status);
CREATE INDEX IF NOT EXISTS idx_wawi_quotes_lexware_id ON wawi_quotes(lexware_quotation_id) WHERE lexware_quotation_id IS NOT NULL;
