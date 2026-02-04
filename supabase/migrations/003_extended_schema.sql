-- ============================================================================
-- BROjekt Extended Schema Migration
-- Version: 002
-- Date: 2026-02-02
-- Description: Kunden, Angebote, Subunternehmer, Termine, Rapporte, Dokumente, Formulare
-- ============================================================================

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

-- Kundentyp
CREATE TYPE customer_type AS ENUM ('private', 'business', 'public');

-- Kundenstatus
CREATE TYPE customer_status AS ENUM ('active', 'inactive', 'blocked');

-- Angebotsstatus
CREATE TYPE quote_status AS ENUM ('draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'revised');

-- Subunternehmer-Gewerk
CREATE TYPE trade_type AS ENUM (
    'elektriker',
    'dachdecker', 
    'sanitaer',
    'heizung',
    'klima',
    'maler',
    'trockenbau',
    'geruestbau',
    'tiefbau',
    'zimmerer',
    'sonstige'
);

-- Subunternehmer-Status
CREATE TYPE subcontractor_status AS ENUM ('active', 'inactive', 'blacklisted', 'pending');

-- Termintyp
CREATE TYPE appointment_type AS ENUM (
    'aufmass',
    'vob_termin',
    'montage_start',
    'montage_end',
    'abnahme',
    'nachbesserung',
    'wartung',
    'beratung',
    'sonstiges'
);

-- Terminstatus
CREATE TYPE appointment_status AS ENUM ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rescheduled');

-- Rapport-Typ
CREATE TYPE report_type AS ENUM ('daily', 'material', 'issue', 'progress', 'handover', 'acceptance');

-- Dokumenttyp
CREATE TYPE document_type AS ENUM (
    'vertrag',
    'angebot',
    'rechnung',
    'aufmass',
    'plan',
    'foto',
    'protokoll',
    'unterschrift',
    'datenschutz',
    'sonstiges'
);

-- Formular-Status
CREATE TYPE form_status AS ENUM ('draft', 'submitted', 'approved', 'rejected');

-- User Role erweitern (falls noch nicht vorhanden)
DO $$ BEGIN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'mitarbeiter';
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'subcontractor';
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'customer';
EXCEPTION
    WHEN invalid_parameter_value THEN NULL;
    WHEN undefined_object THEN 
        -- Falls user_role nicht existiert, erstellen wir es
        CREATE TYPE user_role AS ENUM ('admin', 'mitarbeiter', 'subcontractor', 'customer', 'viewer');
END $$;

-- ============================================================================
-- TABELLEN
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CUSTOMERS - Kunden (aus Leads konvertiert)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Referenz zum ursprünglichen Lead
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    
    -- Lexware Integration
    lexware_id VARCHAR(50) UNIQUE,
    lexware_sync_at TIMESTAMP WITH TIME ZONE,
    
    -- Basis-Daten
    customer_number VARCHAR(50) UNIQUE,
    customer_type customer_type DEFAULT 'private',
    status customer_status DEFAULT 'active',
    
    -- Kontakt
    company_name VARCHAR(255),
    salutation VARCHAR(20),
    first_name VARCHAR(100),
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(100),
    mobile VARCHAR(100),
    
    -- Adresse
    street VARCHAR(255),
    house_number VARCHAR(20),
    postal_code VARCHAR(10),
    city VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Deutschland',
    
    -- Rechnungsadresse (falls abweichend)
    billing_street VARCHAR(255),
    billing_house_number VARCHAR(20),
    billing_postal_code VARCHAR(10),
    billing_city VARCHAR(100),
    billing_country VARCHAR(100),
    
    -- Zusätzliche Infos
    tax_id VARCHAR(50),
    notes TEXT,
    tags TEXT[], -- z.B. ['PV', 'Bestand', 'VIP']
    
    -- Verknüpfungen
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Meta
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indizes für customers
CREATE INDEX IF NOT EXISTS idx_customers_lexware_id ON customers(lexware_id);
CREATE INDEX IF NOT EXISTS idx_customers_customer_number ON customers(customer_number);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_last_name ON customers(last_name);
CREATE INDEX IF NOT EXISTS idx_customers_postal_code ON customers(postal_code);

-- ----------------------------------------------------------------------------
-- 2. QUOTES - Angebote
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Referenzen
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    
    -- Lexware Integration
    lexware_quote_id VARCHAR(50) UNIQUE,
    lexware_sync_at TIMESTAMP WITH TIME ZONE,
    
    -- Angebotsdaten
    quote_number VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status quote_status DEFAULT 'draft',
    
    -- Beträge
    net_amount NUMERIC(15,2),
    tax_rate NUMERIC(5,2) DEFAULT 19.00,
    tax_amount NUMERIC(15,2),
    gross_amount NUMERIC(15,2),
    discount_percent NUMERIC(5,2),
    discount_amount NUMERIC(15,2),
    
    -- Positionen als JSONB
    line_items JSONB DEFAULT '[]'::jsonb,
    -- Struktur: [{ position: 1, description: "", quantity: 1, unit: "Stk", unit_price: 100.00, total: 100.00 }]
    
    -- Termine
    valid_until DATE,
    sent_at TIMESTAMP WITH TIME ZONE,
    viewed_at TIMESTAMP WITH TIME ZONE,
    accepted_at TIMESTAMP WITH TIME ZONE,
    rejected_at TIMESTAMP WITH TIME ZONE,
    
    -- PDF
    pdf_url TEXT, -- OneDrive URL oder Supabase Storage
    pdf_generated_at TIMESTAMP WITH TIME ZONE,
    
    -- Notizen
    internal_notes TEXT,
    customer_notes TEXT, -- Wird auf Angebot angezeigt
    
    -- Verknüpfungen
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Meta
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indizes für quotes
CREATE INDEX IF NOT EXISTS idx_quotes_customer_id ON quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_project_id ON quotes(project_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_quote_number ON quotes(quote_number);
CREATE INDEX IF NOT EXISTS idx_quotes_lexware_quote_id ON quotes(lexware_quote_id);
CREATE INDEX IF NOT EXISTS idx_quotes_created_at ON quotes(created_at DESC);

-- ----------------------------------------------------------------------------
-- 3. SUBCONTRACTORS - Subunternehmer
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subcontractors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Basis-Daten
    company_name VARCHAR(255) NOT NULL,
    trade trade_type NOT NULL,
    trades trade_type[] DEFAULT '{}', -- Mehrere Gewerke möglich
    status subcontractor_status DEFAULT 'active',
    
    -- Kontaktperson
    contact_name VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(100),
    contact_mobile VARCHAR(100),
    
    -- Firma
    email VARCHAR(255),
    phone VARCHAR(100),
    website VARCHAR(255),
    
    -- Adresse
    street VARCHAR(255),
    house_number VARCHAR(20),
    postal_code VARCHAR(10),
    city VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Deutschland',
    
    -- Geschäftsdaten
    tax_id VARCHAR(50),
    trade_license VARCHAR(100), -- Handwerkskammer-Nummer
    insurance_valid_until DATE,
    
    -- Bewertung
    rating NUMERIC(2,1) CHECK (rating >= 1 AND rating <= 5),
    rating_count INTEGER DEFAULT 0,
    
    -- Konditionen
    hourly_rate NUMERIC(10,2),
    payment_terms INTEGER DEFAULT 30, -- Tage
    
    -- Notizen
    notes TEXT,
    tags TEXT[],
    
    -- User-Verknüpfung (für Portal-Zugang)
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Meta
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indizes für subcontractors
CREATE INDEX IF NOT EXISTS idx_subcontractors_trade ON subcontractors(trade);
CREATE INDEX IF NOT EXISTS idx_subcontractors_trades ON subcontractors USING GIN(trades);
CREATE INDEX IF NOT EXISTS idx_subcontractors_status ON subcontractors(status);
CREATE INDEX IF NOT EXISTS idx_subcontractors_postal_code ON subcontractors(postal_code);
CREATE INDEX IF NOT EXISTS idx_subcontractors_rating ON subcontractors(rating DESC);

-- ----------------------------------------------------------------------------
-- 4. PROJECT_SUBCONTRACTORS - Zuordnung Projekt ↔ Subunternehmer
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_subcontractors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    subcontractor_id UUID NOT NULL REFERENCES subcontractors(id) ON DELETE CASCADE,
    
    -- Rolle im Projekt
    trade trade_type NOT NULL,
    scope TEXT, -- Beschreibung des Auftrags
    
    -- Vertrag/Kosten
    agreed_amount NUMERIC(15,2),
    actual_amount NUMERIC(15,2),
    payment_status VARCHAR(50) DEFAULT 'pending', -- pending, partial, paid
    
    -- Termine
    start_date DATE,
    end_date DATE,
    
    -- Status
    status VARCHAR(50) DEFAULT 'assigned', -- assigned, working, completed, cancelled
    
    -- Bewertung nach Abschluss
    project_rating NUMERIC(2,1),
    project_feedback TEXT,
    
    -- Meta
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique Constraint
    UNIQUE(project_id, subcontractor_id, trade)
);

-- Indizes für project_subcontractors
CREATE INDEX IF NOT EXISTS idx_project_subcontractors_project ON project_subcontractors(project_id);
CREATE INDEX IF NOT EXISTS idx_project_subcontractors_subcontractor ON project_subcontractors(subcontractor_id);
CREATE INDEX IF NOT EXISTS idx_project_subcontractors_status ON project_subcontractors(status);

-- ----------------------------------------------------------------------------
-- 5. APPOINTMENTS - Termine
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Referenzen
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
    
    -- Termin-Details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    appointment_type appointment_type NOT NULL,
    status appointment_status DEFAULT 'scheduled',
    
    -- Zeit
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    all_day BOOLEAN DEFAULT FALSE,
    
    -- Ort
    location_type VARCHAR(50) DEFAULT 'customer', -- customer, office, other
    location_address TEXT,
    location_notes TEXT,
    
    -- Teilnehmer
    assigned_to UUID[] DEFAULT '{}', -- Mitarbeiter UUIDs
    subcontractor_ids UUID[] DEFAULT '{}', -- Subunternehmer UUIDs
    
    -- Erinnerungen
    reminder_sent BOOLEAN DEFAULT FALSE,
    reminder_minutes INTEGER DEFAULT 60, -- Minuten vor Termin
    
    -- Ergebnis
    completed_at TIMESTAMP WITH TIME ZONE,
    outcome TEXT, -- Ergebnis/Notizen nach Termin
    follow_up_required BOOLEAN DEFAULT FALSE,
    follow_up_notes TEXT,
    
    -- Externe Kalender
    external_calendar_id VARCHAR(255), -- Google/Outlook Calendar ID
    
    -- Meta
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indizes für appointments
CREATE INDEX IF NOT EXISTS idx_appointments_project_id ON appointments(project_id);
CREATE INDEX IF NOT EXISTS idx_appointments_customer_id ON appointments(customer_id);
CREATE INDEX IF NOT EXISTS idx_appointments_start_time ON appointments(start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_type ON appointments(appointment_type);
CREATE INDEX IF NOT EXISTS idx_appointments_assigned_to ON appointments USING GIN(assigned_to);

-- ----------------------------------------------------------------------------
-- 6. REPORTS - Rapporte/Baustellendokumentation
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Referenzen
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    
    -- Rapport-Details
    report_number VARCHAR(50),
    report_type report_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    report_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Arbeitszeit
    work_start TIME,
    work_end TIME,
    break_minutes INTEGER DEFAULT 0,
    
    -- Personal (als JSONB für Flexibilität)
    workers JSONB DEFAULT '[]'::jsonb,
    -- Struktur: [{ user_id: "", name: "", hours: 8, role: "Monteur" }]
    
    -- Material
    materials JSONB DEFAULT '[]'::jsonb,
    -- Struktur: [{ name: "", quantity: 1, unit: "Stk", notes: "" }]
    
    -- Inhalt
    description TEXT,
    work_performed TEXT,
    issues TEXT,
    next_steps TEXT,
    
    -- Wetter (für Außenarbeiten)
    weather VARCHAR(100),
    temperature INTEGER, -- Celsius
    
    -- Status
    status VARCHAR(50) DEFAULT 'draft', -- draft, submitted, approved
    submitted_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    
    -- Unterschriften
    worker_signature_id UUID, -- Referenz zu documents
    customer_signature_id UUID, -- Referenz zu documents
    
    -- Meta
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indizes für reports
CREATE INDEX IF NOT EXISTS idx_reports_project_id ON reports(project_id);
CREATE INDEX IF NOT EXISTS idx_reports_report_date ON reports(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(report_type);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);

-- ----------------------------------------------------------------------------
-- 7. DOCUMENTS - Dokumente
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Referenzen (polymorphe Verknüpfung)
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
    report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
    
    -- Dokument-Details
    document_type document_type NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Speicherort
    storage_type VARCHAR(50) DEFAULT 'supabase', -- supabase, onedrive, local
    storage_path TEXT NOT NULL, -- Pfad in Storage
    storage_url TEXT, -- Direkter URL falls verfügbar
    
    -- OneDrive spezifisch
    onedrive_item_id VARCHAR(255),
    onedrive_drive_id VARCHAR(255),
    onedrive_web_url TEXT,
    
    -- Datei-Metadaten
    file_name VARCHAR(255) NOT NULL,
    file_extension VARCHAR(20),
    file_size BIGINT, -- Bytes
    mime_type VARCHAR(100),
    
    -- Für Unterschriften
    is_signature BOOLEAN DEFAULT FALSE,
    signed_by VARCHAR(255),
    signed_at TIMESTAMP WITH TIME ZONE,
    signature_ip VARCHAR(50),
    
    -- Versioning
    version INTEGER DEFAULT 1,
    parent_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    
    -- Meta
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indizes für documents
CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_customer_id ON documents(customer_id);
CREATE INDEX IF NOT EXISTS idx_documents_quote_id ON documents(quote_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type);
CREATE INDEX IF NOT EXISTS idx_documents_storage_type ON documents(storage_type);
CREATE INDEX IF NOT EXISTS idx_documents_onedrive_item_id ON documents(onedrive_item_id);

-- ----------------------------------------------------------------------------
-- 8. FORM_TEMPLATES - Formularvorlagen
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS form_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Basis
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    category VARCHAR(100), -- z.B. 'Aufnahme', 'Datenschutz', 'Abnahme'
    
    -- Formular-Definition als JSONB
    fields JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Struktur: [{
    --   id: "field_1",
    --   type: "text|number|email|phone|textarea|select|checkbox|radio|date|signature|file",
    --   label: "Vorname",
    --   placeholder: "",
    --   required: true,
    --   options: [], -- für select/radio
    --   validation: { min: 0, max: 100, pattern: "" }
    -- }]
    
    -- Layout
    layout JSONB DEFAULT '{}'::jsonb,
    -- Struktur: { columns: 2, sections: [{ title: "", fields: ["field_1", "field_2"] }] }
    
    -- Settings
    requires_signature BOOLEAN DEFAULT FALSE,
    requires_customer_email BOOLEAN DEFAULT FALSE,
    send_confirmation_email BOOLEAN DEFAULT FALSE,
    
    -- Aktiv/Archiviert
    active BOOLEAN DEFAULT TRUE,
    version INTEGER DEFAULT 1,
    
    -- Meta
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indizes für form_templates
CREATE INDEX IF NOT EXISTS idx_form_templates_slug ON form_templates(slug);
CREATE INDEX IF NOT EXISTS idx_form_templates_category ON form_templates(category);
CREATE INDEX IF NOT EXISTS idx_form_templates_active ON form_templates(active);

-- ----------------------------------------------------------------------------
-- 9. FORM_SUBMISSIONS - Ausgefüllte Formulare
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS form_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Referenzen
    template_id UUID NOT NULL REFERENCES form_templates(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    
    -- Formular-Daten
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Struktur: { field_1: "Max", field_2: "Mustermann", ... }
    
    -- Status
    status form_status DEFAULT 'submitted',
    
    -- Unterschrift
    signature_document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    signed_at TIMESTAMP WITH TIME ZONE,
    signed_by_name VARCHAR(255),
    signed_by_email VARCHAR(255),
    
    -- Submission Info
    submitted_ip VARCHAR(50),
    submitted_user_agent TEXT,
    
    -- Review
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,
    
    -- Meta
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indizes für form_submissions
CREATE INDEX IF NOT EXISTS idx_form_submissions_template_id ON form_submissions(template_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_project_id ON form_submissions(project_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_customer_id ON form_submissions(customer_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_status ON form_submissions(status);
CREATE INDEX IF NOT EXISTS idx_form_submissions_created_at ON form_submissions(created_at DESC);

-- ============================================================================
-- FOREIGN KEY für reports Unterschriften (nachträglich wegen Abhängigkeit)
-- ============================================================================
ALTER TABLE reports 
    ADD CONSTRAINT fk_reports_worker_signature 
    FOREIGN KEY (worker_signature_id) REFERENCES documents(id) ON DELETE SET NULL;

ALTER TABLE reports 
    ADD CONSTRAINT fk_reports_customer_signature 
    FOREIGN KEY (customer_signature_id) REFERENCES documents(id) ON DELETE SET NULL;

-- ============================================================================
-- TRIGGER für updated_at
-- ============================================================================

-- Trigger-Funktion existiert bereits, aber wir erstellen sie falls nicht vorhanden
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger für alle neuen Tabellen
CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quotes_updated_at
    BEFORE UPDATE ON quotes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subcontractors_updated_at
    BEFORE UPDATE ON subcontractors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_subcontractors_updated_at
    BEFORE UPDATE ON project_subcontractors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
    BEFORE UPDATE ON appointments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reports_updated_at
    BEFORE UPDATE ON reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_form_templates_updated_at
    BEFORE UPDATE ON form_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_form_submissions_updated_at
    BEFORE UPDATE ON form_submissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- RLS aktivieren für alle Tabellen
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcontractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_subcontractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- Helper Function: Get User Role
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_user_role(user_uuid UUID)
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role::TEXT INTO user_role FROM users WHERE id = user_uuid OR auth_id = user_uuid::TEXT;
    RETURN COALESCE(user_role, 'viewer');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper Function: Check if user is admin or mitarbeiter
CREATE OR REPLACE FUNCTION is_internal_user()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_user_role(auth.uid()) IN ('admin', 'mitarbeiter', 'user');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper Function: Check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_user_role(auth.uid()) = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- CUSTOMERS Policies
-- ----------------------------------------------------------------------------
-- Admin/Mitarbeiter: Vollzugriff
CREATE POLICY "Internal users can manage customers"
    ON customers FOR ALL
    TO authenticated
    USING (is_internal_user())
    WITH CHECK (is_internal_user());

-- Kunden: Nur eigene Daten lesen
CREATE POLICY "Customers can read own data"
    ON customers FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_id::uuid = auth.uid() 
            AND users.role::TEXT = 'customer'
            AND customers.id = (
                SELECT c.id FROM customers c 
                JOIN users u ON u.email = c.email 
                WHERE u.auth_id::uuid = auth.uid()
            )
        )
    );

-- ----------------------------------------------------------------------------
-- QUOTES Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Internal users can manage quotes"
    ON quotes FOR ALL
    TO authenticated
    USING (is_internal_user())
    WITH CHECK (is_internal_user());

-- Kunden können ihre Angebote lesen
CREATE POLICY "Customers can read own quotes"
    ON quotes FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM customers c
            JOIN users u ON u.email = c.email
            WHERE u.auth_id::uuid = auth.uid()
            AND c.id = quotes.customer_id
        )
    );

-- ----------------------------------------------------------------------------
-- SUBCONTRACTORS Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Internal users can manage subcontractors"
    ON subcontractors FOR ALL
    TO authenticated
    USING (is_internal_user())
    WITH CHECK (is_internal_user());

-- Subunternehmer können eigene Daten lesen
CREATE POLICY "Subcontractors can read own data"
    ON subcontractors FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Subunternehmer können eigene Daten aktualisieren
CREATE POLICY "Subcontractors can update own data"
    ON subcontractors FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- PROJECT_SUBCONTRACTORS Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Internal users can manage project_subcontractors"
    ON project_subcontractors FOR ALL
    TO authenticated
    USING (is_internal_user())
    WITH CHECK (is_internal_user());

-- Subunternehmer können ihre Projektzuordnungen sehen
CREATE POLICY "Subcontractors can read own assignments"
    ON project_subcontractors FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM subcontractors s
            WHERE s.id = project_subcontractors.subcontractor_id
            AND s.user_id = auth.uid()
        )
    );

-- ----------------------------------------------------------------------------
-- APPOINTMENTS Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Internal users can manage appointments"
    ON appointments FOR ALL
    TO authenticated
    USING (is_internal_user())
    WITH CHECK (is_internal_user());

-- Kunden können ihre Termine sehen
CREATE POLICY "Customers can read own appointments"
    ON appointments FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM customers c
            JOIN users u ON u.email = c.email
            WHERE u.auth_id::uuid = auth.uid()
            AND c.id = appointments.customer_id
        )
    );

-- Subunternehmer können zugewiesene Termine sehen
CREATE POLICY "Subcontractors can read assigned appointments"
    ON appointments FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM subcontractors s
            WHERE s.user_id = auth.uid()
            AND s.id = ANY(appointments.subcontractor_ids)
        )
    );

-- ----------------------------------------------------------------------------
-- REPORTS Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Internal users can manage reports"
    ON reports FOR ALL
    TO authenticated
    USING (is_internal_user())
    WITH CHECK (is_internal_user());

-- Subunternehmer können Rapporte zu ihren Projekten sehen
CREATE POLICY "Subcontractors can read project reports"
    ON reports FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM project_subcontractors ps
            JOIN subcontractors s ON s.id = ps.subcontractor_id
            WHERE s.user_id = auth.uid()
            AND ps.project_id = reports.project_id
        )
    );

-- ----------------------------------------------------------------------------
-- DOCUMENTS Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Internal users can manage documents"
    ON documents FOR ALL
    TO authenticated
    USING (is_internal_user())
    WITH CHECK (is_internal_user());

-- Kunden können ihre Dokumente sehen
CREATE POLICY "Customers can read own documents"
    ON documents FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM customers c
            JOIN users u ON u.email = c.email
            WHERE u.auth_id::uuid = auth.uid()
            AND c.id = documents.customer_id
        )
    );

-- ----------------------------------------------------------------------------
-- FORM_TEMPLATES Policies
-- ----------------------------------------------------------------------------
-- Nur interne User können Vorlagen verwalten
CREATE POLICY "Internal users can manage form_templates"
    ON form_templates FOR ALL
    TO authenticated
    USING (is_internal_user())
    WITH CHECK (is_internal_user());

-- Alle authentifizierten User können aktive Vorlagen lesen (zum Ausfüllen)
CREATE POLICY "Authenticated users can read active templates"
    ON form_templates FOR SELECT
    TO authenticated
    USING (active = TRUE);

-- ----------------------------------------------------------------------------
-- FORM_SUBMISSIONS Policies
-- ----------------------------------------------------------------------------
CREATE POLICY "Internal users can manage form_submissions"
    ON form_submissions FOR ALL
    TO authenticated
    USING (is_internal_user())
    WITH CHECK (is_internal_user());

-- Kunden können eigene Submissions sehen
CREATE POLICY "Customers can read own submissions"
    ON form_submissions FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM customers c
            JOIN users u ON u.email = c.email
            WHERE u.auth_id::uuid = auth.uid()
            AND c.id = form_submissions.customer_id
        )
    );

-- Alle authentifizierten User können Formulare einreichen
CREATE POLICY "Authenticated users can submit forms"
    ON form_submissions FOR INSERT
    TO authenticated
    WITH CHECK (TRUE);

-- ============================================================================
-- VIEWS für häufige Abfragen
-- ============================================================================

-- Kunden mit Statistiken
CREATE OR REPLACE VIEW customer_stats AS
SELECT 
    c.*,
    COUNT(DISTINCT q.id) AS total_quotes,
    COUNT(DISTINCT q.id) FILTER (WHERE q.status = 'accepted') AS accepted_quotes,
    SUM(q.gross_amount) FILTER (WHERE q.status = 'accepted') AS total_revenue,
    COUNT(DISTINCT p.id) AS total_projects,
    MAX(a.start_time) AS last_appointment
FROM customers c
LEFT JOIN quotes q ON q.customer_id = c.id
LEFT JOIN projects p ON p.id = q.project_id
LEFT JOIN appointments a ON a.customer_id = c.id
GROUP BY c.id;

-- Subunternehmer mit Statistiken
CREATE OR REPLACE VIEW subcontractor_stats AS
SELECT 
    s.*,
    COUNT(DISTINCT ps.project_id) AS total_projects,
    COUNT(DISTINCT ps.project_id) FILTER (WHERE ps.status = 'completed') AS completed_projects,
    AVG(ps.project_rating) AS avg_project_rating,
    SUM(ps.actual_amount) AS total_revenue
FROM subcontractors s
LEFT JOIN project_subcontractors ps ON ps.subcontractor_id = s.id
GROUP BY s.id;

-- Projekt-Übersicht mit allen Verknüpfungen
CREATE OR REPLACE VIEW project_overview AS
SELECT 
    p.*,
    c.id AS customer_id,
    c.first_name || ' ' || c.last_name AS customer_name,
    COUNT(DISTINCT ps.subcontractor_id) AS subcontractor_count,
    COUNT(DISTINCT a.id) AS appointment_count,
    COUNT(DISTINCT r.id) AS report_count,
    COUNT(DISTINCT d.id) AS document_count
FROM projects p
LEFT JOIN quotes q ON q.project_id = p.id AND q.status = 'accepted'
LEFT JOIN customers c ON c.id = q.customer_id
LEFT JOIN project_subcontractors ps ON ps.project_id = p.id
LEFT JOIN appointments a ON a.project_id = p.id
LEFT JOIN reports r ON r.project_id = p.id
LEFT JOIN documents d ON d.project_id = p.id
GROUP BY p.id, c.id, c.first_name, c.last_name;

-- ============================================================================
-- GRANTS
-- ============================================================================

-- Grants für authenticated users (Supabase Auth)
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Grants für anon users (nur Lesen von aktiven Form Templates)
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON form_templates TO anon;

-- ============================================================================
-- KOMMENTARE
-- ============================================================================

COMMENT ON TABLE customers IS 'Kunden - konvertiert aus Leads, mit Lexware-Integration';
COMMENT ON TABLE quotes IS 'Angebote - mit Lexware-Integration und PDF-Speicherung';
COMMENT ON TABLE subcontractors IS 'Subunternehmer - Elektriker, Dachdecker, etc.';
COMMENT ON TABLE project_subcontractors IS 'Zuordnung von Subunternehmern zu Projekten';
COMMENT ON TABLE appointments IS 'Termine - VOB, Montage, Abnahme, etc.';
COMMENT ON TABLE reports IS 'Rapporte und Baustellendokumentation';
COMMENT ON TABLE documents IS 'Dokumente mit OneDrive-Integration';
COMMENT ON TABLE form_templates IS 'Formularvorlagen für Aufnahmebogen, Datenschutz, etc.';
COMMENT ON TABLE form_submissions IS 'Ausgefüllte und eingereichte Formulare';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
