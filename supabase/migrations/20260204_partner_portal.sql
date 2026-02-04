-- ============================================
-- PARTNER PORTAL SCHEMA
-- Created: 2026-02-04
-- ============================================

-- Partner-Firma (Subunternehmer)
CREATE TABLE IF NOT EXISTS partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  trade TEXT, -- 'elektro', 'dach', 'montage', 'allround'
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  logo_url TEXT,
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Partner-Benutzer (Admin + Mitarbeiter)
CREATE TABLE IF NOT EXISTS partner_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'worker', -- 'admin' | 'worker'
  active BOOLEAN DEFAULT true,
  invite_token TEXT,
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(partner_id, email)
);

-- Aufträge für Partner
CREATE TABLE IF NOT EXISTS partner_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  
  title TEXT NOT NULL,
  description TEXT,
  trade TEXT, -- Welches Gewerk gebraucht wird
  
  -- Zeitplanung
  scheduled_date DATE,
  scheduled_time_start TIME,
  scheduled_time_end TIME,
  estimated_hours DECIMAL(5,2),
  
  -- Status: open → accepted/declined → in_progress → completed
  status TEXT DEFAULT 'open',
  
  -- Wer hat angenommen (Firma)
  accepted_by_partner_id UUID REFERENCES partners(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  declined_reason TEXT,
  
  -- Zuweisung an Mitarbeiter
  assigned_to_user_id UUID REFERENCES partner_users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  
  -- Fertigstellung
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Rapport (Fertigmeldung)
CREATE TABLE IF NOT EXISTS job_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES partner_jobs(id) ON DELETE CASCADE,
  partner_user_id UUID NOT NULL REFERENCES partner_users(id) ON DELETE CASCADE,
  
  -- Bericht
  report_text TEXT,
  work_done TEXT, -- Was wurde gemacht
  issues TEXT, -- Probleme/Anmerkungen
  
  -- Fotos (Array von URLs)
  photos JSONB DEFAULT '[]'::jsonb, -- [{url, caption, uploaded_at}]
  
  -- Kundenunterschrift
  customer_signature_url TEXT,
  customer_name TEXT,
  signed_at TIMESTAMPTZ,
  
  -- Status
  status TEXT DEFAULT 'draft', -- 'draft', 'submitted', 'approved'
  submitted_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Partner-Rechnungen (an BROjekt)
CREATE TABLE IF NOT EXISTS partner_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  job_id UUID REFERENCES partner_jobs(id) ON DELETE SET NULL,
  
  invoice_number TEXT,
  invoice_date DATE,
  file_url TEXT NOT NULL,
  amount DECIMAL(10,2),
  notes TEXT,
  
  status TEXT DEFAULT 'uploaded', -- 'uploaded', 'reviewed', 'approved', 'paid'
  reviewed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TERMINE & SLOTS
-- ============================================

-- Termine (für Kunden und Partner)
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  
  title TEXT NOT NULL,
  type TEXT, -- 'besichtigung', 'beratung', 'montage', 'abnahme', 'sonstiges'
  description TEXT,
  
  date DATE NOT NULL,
  time_start TIME,
  time_end TIME,
  all_day BOOLEAN DEFAULT false,
  
  location TEXT,
  
  -- Wer hat erstellt/gebucht
  booked_by TEXT, -- 'customer', 'brojekt', 'partner'
  booked_by_id UUID,
  
  -- Zuordnung zu Partner-Job
  partner_job_id UUID REFERENCES partner_jobs(id) ON DELETE SET NULL,
  
  notes TEXT,
  status TEXT DEFAULT 'confirmed', -- 'pending', 'confirmed', 'cancelled'
  cancelled_reason TEXT,
  
  -- Kalender-Sync
  calendar_event_id TEXT,
  calendar_synced_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Verfügbare Buchungsslots (für Kundenbuchung)
CREATE TABLE IF NOT EXISTS available_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  date DATE NOT NULL,
  time_start TIME NOT NULL,
  time_end TIME NOT NULL,
  
  slot_type TEXT NOT NULL, -- 'besichtigung', 'beratung'
  max_bookings INT DEFAULT 1,
  current_bookings INT DEFAULT 0,
  
  notes TEXT,
  active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- ZAHLUNGEN
-- ============================================

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  
  description TEXT NOT NULL, -- '50% Anzahlung bei Materiallieferung', '50% nach Montage'
  amount DECIMAL(10,2) NOT NULL,
  
  due_date DATE,
  reminder_sent_at TIMESTAMPTZ,
  
  status TEXT DEFAULT 'pending', -- 'pending', 'partial', 'paid', 'overdue'
  paid_amount DECIMAL(10,2) DEFAULT 0,
  paid_at TIMESTAMPTZ,
  
  -- Lexware-Verknüpfung
  lexware_invoice_id TEXT,
  lexware_invoice_number TEXT,
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- NACHRICHTEN / CHAT
-- ============================================

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Absender
  sender_type TEXT NOT NULL, -- 'customer', 'partner', 'brojekt'
  sender_id UUID, -- customer_id, partner_user_id, oder profile_id
  sender_name TEXT,
  
  -- Inhalt
  text TEXT NOT NULL,
  attachments JSONB DEFAULT '[]'::jsonb, -- [{url, name, type, size}]
  
  -- Sichtbarkeit
  visible_to_customer BOOLEAN DEFAULT true,
  visible_to_partners BOOLEAN DEFAULT true,
  is_internal BOOLEAN DEFAULT false, -- Nur für BROjekt
  
  -- Gelesen-Status
  read_by JSONB DEFAULT '[]'::jsonb, -- [{type, id, at}]
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- BENACHRICHTIGUNGEN
-- ============================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Empfänger
  recipient_type TEXT NOT NULL, -- 'customer', 'partner_user', 'profile'
  recipient_id UUID NOT NULL,
  
  -- Inhalt
  type TEXT NOT NULL, -- 'new_job', 'job_accepted', 'message', 'appointment', 'payment', etc.
  title TEXT NOT NULL,
  body TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  
  -- Link
  action_url TEXT,
  
  -- Zustellung
  channels JSONB DEFAULT '["push"]'::jsonb, -- ['push', 'email', 'whatsapp']
  delivered_via JSONB DEFAULT '[]'::jsonb,
  delivery_errors JSONB DEFAULT '[]'::jsonb,
  
  -- Status
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- ERWEITERUNGEN BESTEHENDER TABELLEN
-- ============================================

-- Documents: Sichtbarkeit
ALTER TABLE documents 
  ADD COLUMN IF NOT EXISTS uploaded_by TEXT,
  ADD COLUMN IF NOT EXISTS uploaded_by_id UUID,
  ADD COLUMN IF NOT EXISTS visible_to_customer BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS visible_to_partners BOOLEAN DEFAULT false;

-- Profiles: Partner-Verknüpfung
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS partner_user_id UUID REFERENCES partner_users(id) ON DELETE SET NULL;

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_partner_users_partner_id ON partner_users(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_users_auth_user_id ON partner_users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_partner_users_email ON partner_users(email);
CREATE INDEX IF NOT EXISTS idx_partner_users_invite_token ON partner_users(invite_token);

CREATE INDEX IF NOT EXISTS idx_partner_jobs_project_id ON partner_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_partner_jobs_status ON partner_jobs(status);
CREATE INDEX IF NOT EXISTS idx_partner_jobs_accepted_by ON partner_jobs(accepted_by_partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_jobs_assigned_to ON partner_jobs(assigned_to_user_id);

CREATE INDEX IF NOT EXISTS idx_job_reports_job_id ON job_reports(job_id);
CREATE INDEX IF NOT EXISTS idx_partner_invoices_partner_id ON partner_invoices(partner_id);

CREATE INDEX IF NOT EXISTS idx_appointments_project_id ON appointments(project_id);
CREATE INDEX IF NOT EXISTS idx_appointments_customer_id ON appointments(customer_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);

CREATE INDEX IF NOT EXISTS idx_payments_project_id ON payments(project_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

CREATE INDEX IF NOT EXISTS idx_messages_project_id ON messages(project_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_type, recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON notifications(read_at) WHERE read_at IS NULL;

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE available_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Partner: Partner-User können ihre eigene Firma sehen
CREATE POLICY "Partner users can view own partner" ON partners
  FOR SELECT USING (
    id IN (SELECT partner_id FROM partner_users WHERE auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- Partner Users: Eigene Firma sehen, Admin kann alle sehen
CREATE POLICY "Partner users can view own team" ON partner_users
  FOR SELECT USING (
    partner_id IN (SELECT partner_id FROM partner_users WHERE auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- Partner Users: Admin kann Team verwalten
CREATE POLICY "Partner admin can manage team" ON partner_users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM partner_users pu 
      WHERE pu.auth_user_id = auth.uid() 
      AND pu.partner_id = partner_users.partner_id 
      AND pu.role = 'admin'
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- Jobs: Partner sieht offene Jobs und eigene
CREATE POLICY "Partners can view available and own jobs" ON partner_jobs
  FOR SELECT USING (
    status = 'open'
    OR accepted_by_partner_id IN (SELECT partner_id FROM partner_users WHERE auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- Jobs: Partner kann eigene Jobs updaten
CREATE POLICY "Partners can update own jobs" ON partner_jobs
  FOR UPDATE USING (
    accepted_by_partner_id IN (SELECT partner_id FROM partner_users WHERE auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- Reports: Eigene Berichte
CREATE POLICY "Partners can manage own reports" ON job_reports
  FOR ALL USING (
    partner_user_id IN (SELECT id FROM partner_users WHERE auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- Invoices: Eigene Rechnungen
CREATE POLICY "Partners can manage own invoices" ON partner_invoices
  FOR ALL USING (
    partner_id IN (SELECT partner_id FROM partner_users WHERE auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- Appointments: Kunde sieht eigene, Partner sieht zugewiesene
CREATE POLICY "Users can view relevant appointments" ON appointments
  FOR SELECT USING (
    customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid())
    OR partner_job_id IN (
      SELECT id FROM partner_jobs 
      WHERE accepted_by_partner_id IN (SELECT partner_id FROM partner_users WHERE auth_user_id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE auth_id = auth.uid() AND role IN ('admin', 'user'))
  );

-- Available Slots: Alle authentifizierten User
CREATE POLICY "Authenticated users can view slots" ON available_slots
  FOR SELECT USING (active = true);

-- Payments: Kunde sieht eigene
CREATE POLICY "Customers can view own payments" ON payments
  FOR SELECT USING (
    customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE auth_id = auth.uid() AND role IN ('admin', 'user'))
  );

-- Messages: Projekt-Teilnehmer sehen Nachrichten
CREATE POLICY "Project participants can view messages" ON messages
  FOR SELECT USING (
    -- Kunde sieht eigene Projekte
    (visible_to_customer AND project_id IN (
      SELECT id FROM projects WHERE customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid())
    ))
    OR
    -- Partner sieht zugewiesene Projekte
    (visible_to_partners AND project_id IN (
      SELECT project_id FROM partner_jobs 
      WHERE accepted_by_partner_id IN (SELECT partner_id FROM partner_users WHERE auth_user_id = auth.uid())
    ))
    OR
    -- BROjekt sieht alles
    EXISTS (SELECT 1 FROM profiles WHERE auth_id = auth.uid() AND role IN ('admin', 'user'))
  );

-- Messages: Teilnehmer können schreiben
CREATE POLICY "Participants can send messages" ON messages
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid())
    )
    OR project_id IN (
      SELECT project_id FROM partner_jobs 
      WHERE accepted_by_partner_id IN (SELECT partner_id FROM partner_users WHERE auth_user_id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE auth_id = auth.uid() AND role IN ('admin', 'user'))
  );

-- Notifications: Eigene
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (
    (recipient_type = 'customer' AND recipient_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid()))
    OR (recipient_type = 'partner_user' AND recipient_id IN (SELECT id FROM partner_users WHERE auth_user_id = auth.uid()))
    OR (recipient_type = 'profile' AND recipient_id IN (SELECT id FROM profiles WHERE auth_id = auth.uid()))
  );

-- Notifications: Eigene als gelesen markieren
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (
    (recipient_type = 'customer' AND recipient_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid()))
    OR (recipient_type = 'partner_user' AND recipient_id IN (SELECT id FROM partner_users WHERE auth_user_id = auth.uid()))
    OR (recipient_type = 'profile' AND recipient_id IN (SELECT id FROM profiles WHERE auth_id = auth.uid()))
  );

-- ============================================
-- FUNCTIONS
-- ============================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS update_partners_updated_at ON partners;
CREATE TRIGGER update_partners_updated_at BEFORE UPDATE ON partners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_partner_users_updated_at ON partner_users;
CREATE TRIGGER update_partner_users_updated_at BEFORE UPDATE ON partner_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_partner_jobs_updated_at ON partner_jobs;
CREATE TRIGGER update_partner_jobs_updated_at BEFORE UPDATE ON partner_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_job_reports_updated_at ON job_reports;
CREATE TRIGGER update_job_reports_updated_at BEFORE UPDATE ON job_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_appointments_updated_at ON appointments;
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
