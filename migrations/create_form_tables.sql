-- =============================================
-- BROjekt App - Form Tables Migration
-- Ausführen in Supabase Studio → SQL Editor
-- =============================================

-- 1. Form Status Enum (falls nicht existiert)
DO $$ BEGIN
    CREATE TYPE form_status AS ENUM ('draft', 'submitted', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Form Templates Tabelle
CREATE TABLE IF NOT EXISTS form_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    fields JSONB NOT NULL DEFAULT '[]'::jsonb,
    layout JSONB DEFAULT '{}'::jsonb,
    requires_signature BOOLEAN DEFAULT FALSE,
    active BOOLEAN DEFAULT TRUE,
    version INTEGER DEFAULT 1,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Form Submissions Tabelle
CREATE TABLE IF NOT EXISTS form_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_template_id UUID NOT NULL REFERENCES form_templates(id) ON DELETE CASCADE,
    workfolder_id UUID REFERENCES workfolders(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    status form_status DEFAULT 'submitted',
    signature_data TEXT,
    signed_at TIMESTAMP WITH TIME ZONE,
    signed_by_name VARCHAR(255),
    submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Indizes
CREATE INDEX IF NOT EXISTS idx_form_templates_brand ON form_templates(brand_id);
CREATE INDEX IF NOT EXISTS idx_form_templates_active ON form_templates(active);
CREATE INDEX IF NOT EXISTS idx_form_submissions_template ON form_submissions(form_template_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_workfolder ON form_submissions(workfolder_id);

-- 5. RLS aktivieren
ALTER TABLE form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies für form_templates
DROP POLICY IF EXISTS "form_templates_select" ON form_templates;
CREATE POLICY "form_templates_select" ON form_templates FOR SELECT USING (true);
DROP POLICY IF EXISTS "form_templates_insert" ON form_templates;
CREATE POLICY "form_templates_insert" ON form_templates FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "form_templates_update" ON form_templates;
CREATE POLICY "form_templates_update" ON form_templates FOR UPDATE USING (true);
DROP POLICY IF EXISTS "form_templates_delete" ON form_templates;
CREATE POLICY "form_templates_delete" ON form_templates FOR DELETE USING (true);

-- 7. RLS Policies für form_submissions
DROP POLICY IF EXISTS "form_submissions_select" ON form_submissions;
CREATE POLICY "form_submissions_select" ON form_submissions FOR SELECT USING (true);
DROP POLICY IF EXISTS "form_submissions_insert" ON form_submissions;
CREATE POLICY "form_submissions_insert" ON form_submissions FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "form_submissions_update" ON form_submissions;
CREATE POLICY "form_submissions_update" ON form_submissions FOR UPDATE USING (true);
DROP POLICY IF EXISTS "form_submissions_delete" ON form_submissions;
CREATE POLICY "form_submissions_delete" ON form_submissions FOR DELETE USING (true);

-- Fertig!
SELECT 'Form tables created successfully!' as result;
