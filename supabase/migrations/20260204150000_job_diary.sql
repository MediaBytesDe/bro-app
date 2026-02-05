-- Tagebuch-Einträge für Aufträge
CREATE TABLE IF NOT EXISTS job_diary_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES partner_jobs(id) ON DELETE CASCADE,
  partner_user_id UUID NOT NULL REFERENCES partner_users(id) ON DELETE CASCADE,
  
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  text TEXT,
  photos JSONB DEFAULT '[]'::jsonb,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index für schnelle Abfragen
CREATE INDEX IF NOT EXISTS idx_job_diary_job_id ON job_diary_entries(job_id);
CREATE INDEX IF NOT EXISTS idx_job_diary_date ON job_diary_entries(entry_date DESC);

-- RLS deaktivieren für jetzt
ALTER TABLE job_diary_entries DISABLE ROW LEVEL SECURITY;
GRANT ALL ON job_diary_entries TO authenticated, service_role;
