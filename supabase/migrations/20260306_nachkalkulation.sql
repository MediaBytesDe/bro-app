-- ============================================
-- NACHKALKULATION (Post-Calculation)
-- Created: 2026-03-06
-- ============================================

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE cost_type AS ENUM ('subcontractor_invoice', 'material', 'overhead', 'other');
CREATE TYPE cost_status AS ENUM ('pending', 'verified', 'disputed');
CREATE TYPE calculation_status AS ENUM ('open', 'in_review', 'closed');
CREATE TYPE material_direction AS ENUM ('outgoing', 'returning');

-- ============================================
-- TABLE: overhead_settings
-- ============================================

CREATE TABLE IF NOT EXISTS overhead_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL UNIQUE,
  planned_revenue DECIMAL(14,2) NOT NULL DEFAULT 0,
  planned_overhead_costs DECIMAL(14,2) NOT NULL DEFAULT 0,
  overhead_percentage DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN planned_revenue > 0
      THEN ROUND((planned_overhead_costs / planned_revenue) * 100, 2)
      ELSE 0
    END
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- TABLE: project_costs
-- ============================================

CREATE TABLE IF NOT EXISTS project_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  quote_id UUID REFERENCES wawi_quotes(id) ON DELETE SET NULL,
  quote_line_item_key TEXT,
  cost_type cost_type NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  subcontractor_id UUID REFERENCES subcontractors(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES partner_invoices(id) ON DELETE SET NULL,
  status cost_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- TABLE: material_movements
-- ============================================

CREATE TABLE IF NOT EXISTS material_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  subcontractor_id UUID REFERENCES subcontractors(id) ON DELETE SET NULL,
  quote_line_item_key TEXT,
  direction material_direction NOT NULL,
  quantity DECIMAL(10,2) NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- TABLE: project_calculation_status
-- ============================================

CREATE TABLE IF NOT EXISTS project_calculation_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  status calculation_status NOT NULL DEFAULT 'open',
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- RLS
-- ============================================

ALTER TABLE overhead_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_calculation_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "overhead_settings_authenticated_all" ON overhead_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "overhead_settings_service_all" ON overhead_settings FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "project_costs_authenticated_all" ON project_costs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "project_costs_service_all" ON project_costs FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "material_movements_authenticated_all" ON material_movements FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "material_movements_service_all" ON material_movements FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "project_calculation_status_authenticated_all" ON project_calculation_status FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "project_calculation_status_service_all" ON project_calculation_status FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================
-- INDEXES
-- ============================================

-- project_costs
CREATE INDEX IF NOT EXISTS idx_project_costs_project_id ON project_costs(project_id);
CREATE INDEX IF NOT EXISTS idx_project_costs_quote_id ON project_costs(quote_id);
CREATE INDEX IF NOT EXISTS idx_project_costs_invoice_id ON project_costs(invoice_id);

-- material_movements
CREATE INDEX IF NOT EXISTS idx_material_movements_project_id ON material_movements(project_id);
CREATE INDEX IF NOT EXISTS idx_material_movements_product_id ON material_movements(product_id);

-- ============================================
-- TRIGGERS: updated_at
-- ============================================

DROP TRIGGER IF EXISTS update_overhead_settings_updated_at ON overhead_settings;
CREATE TRIGGER update_overhead_settings_updated_at BEFORE UPDATE ON overhead_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_project_costs_updated_at ON project_costs;
CREATE TRIGGER update_project_costs_updated_at BEFORE UPDATE ON project_costs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_project_calculation_status_updated_at ON project_calculation_status;
CREATE TRIGGER update_project_calculation_status_updated_at BEFORE UPDATE ON project_calculation_status
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- TRIGGER: material_movements → products.stock_quantity
-- ============================================

CREATE OR REPLACE FUNCTION update_product_stock_on_movement()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.direction = 'outgoing' THEN
    UPDATE products SET stock_quantity = stock_quantity - NEW.quantity WHERE id = NEW.product_id;
  ELSIF NEW.direction = 'returning' THEN
    UPDATE products SET stock_quantity = stock_quantity + NEW.quantity WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_material_movement_stock ON material_movements;
CREATE TRIGGER trg_material_movement_stock AFTER INSERT ON material_movements
  FOR EACH ROW EXECUTE FUNCTION update_product_stock_on_movement();
