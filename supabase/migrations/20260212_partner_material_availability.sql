-- Material Requests table
CREATE TABLE IF NOT EXISTS partner_material_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id),
  job_id uuid REFERENCES partner_jobs(id),
  project_id uuid REFERENCES projects(id),
  requested_by uuid REFERENCES partner_users(id),
  title text NOT NULL,
  description text,
  items jsonb DEFAULT '[]'::jsonb,
  urgency text DEFAULT 'normal',
  status text DEFAULT 'requested',
  delivery_address text,
  needed_by date,
  notes text,
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Availability table
CREATE TABLE IF NOT EXISTS partner_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id),
  partner_user_id uuid REFERENCES partner_users(id),
  date date NOT NULL,
  status text DEFAULT 'available',
  capacity_percent int DEFAULT 100,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(partner_id, partner_user_id, date)
);

-- RLS
ALTER TABLE partner_material_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partner_material_requests_all_auth" ON partner_material_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "partner_availability_all_auth" ON partner_availability FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_material_requests_partner ON partner_material_requests(partner_id);
CREATE INDEX IF NOT EXISTS idx_material_requests_status ON partner_material_requests(status);
CREATE INDEX IF NOT EXISTS idx_availability_partner_date ON partner_availability(partner_id, date);
