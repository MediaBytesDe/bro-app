-- Counter-Proposal Felder für Gegenvorschläge vom Partner
ALTER TABLE appointment_responses 
ADD COLUMN IF NOT EXISTS counter_proposed_date date,
ADD COLUMN IF NOT EXISTS counter_proposed_time_start time,
ADD COLUMN IF NOT EXISTS counter_proposed_time_end time,
ADD COLUMN IF NOT EXISTS counter_message text;

-- Status "counter" für Gegenvorschläge
COMMENT ON COLUMN appointment_responses.status IS 'pending, accepted, rejected, resolved, counter';
