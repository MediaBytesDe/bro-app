-- WAWI Tables Migration
-- Products (Artikelverwaltung) + Quotes System

-- ============================================================================
-- PRODUCTS TABLE (Artikelstamm)
-- ============================================================================

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Stammdaten
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  manufacturer TEXT,
  sku TEXT UNIQUE NOT NULL,
  
  -- Einkaufspreise
  purchase_list_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  supplier_discount DECIMAL(5,2) DEFAULT 0,
  supplier_skonto DECIMAL(5,2) DEFAULT 0,
  purchase_costs DECIMAL(12,2) DEFAULT 0,
  
  -- Kalkulation
  overhead_percentage DECIMAL(5,2) DEFAULT 25,
  profit_margin DECIMAL(5,2) DEFAULT 30,
  customer_skonto DECIMAL(5,2) DEFAULT 0,
  default_customer_discount DECIMAL(5,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  
  -- Berechnete Preise
  target_purchase_price DECIMAL(12,2) DEFAULT 0,
  bare_purchase_price DECIMAL(12,2) DEFAULT 0,
  reference_price DECIMAL(12,2) DEFAULT 0,
  cost_price DECIMAL(12,2) DEFAULT 0,
  bare_selling_price DECIMAL(12,2) DEFAULT 0,
  target_selling_price DECIMAL(12,2) DEFAULT 0,
  net_selling_price DECIMAL(12,2) DEFAULT 0,
  gross_selling_price DECIMAL(12,2) DEFAULT 0,
  recommended_retail_price DECIMAL(12,2) DEFAULT 0,
  
  -- Lager & Einheiten
  stock_quantity INTEGER DEFAULT 0,
  min_stock_level INTEGER DEFAULT 10,
  location TEXT,
  unit TEXT DEFAULT 'Stück',
  standard_quantity DECIMAL(10,2) DEFAULT 1,
  
  -- Status & Integration
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'discontinued', 'out_of_stock')),
  lexware_article_id TEXT
);

-- Index für schnelle Suche
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);

-- ============================================================================
-- WAWI QUOTES TABLE (Angebote mit erweiterter Kalkulation)
-- ============================================================================

CREATE TABLE IF NOT EXISTS wawi_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Verknüpfungen
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  
  -- Angebotsnummern
  quote_number TEXT,
  lexware_quote_number TEXT,
  lexware_quotation_id TEXT,
  
  -- Datum & Gültigkeit
  quote_date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent_to_lexware', 'sent', 'accepted', 'rejected', 'expired', 'open')),
  
  -- Beträge
  subtotal DECIMAL(12,2) DEFAULT 0,
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) DEFAULT 0,
  
  -- Paket-Rundung
  package_rounding BOOLEAN DEFAULT false,
  rounded_total DECIMAL(12,2),
  
  -- Texte
  introduction_text TEXT,
  footer_text TEXT,
  notes TEXT,
  internal_notes TEXT,
  
  -- Ersteller
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wawi_quotes_customer ON wawi_quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_wawi_quotes_project ON wawi_quotes(project_id);
CREATE INDEX IF NOT EXISTS idx_wawi_quotes_status ON wawi_quotes(status);
CREATE INDEX IF NOT EXISTS idx_wawi_quotes_date ON wawi_quotes(quote_date);

-- ============================================================================
-- WAWI QUOTE ITEMS TABLE (Angebotspositionen)
-- ============================================================================

CREATE TABLE IF NOT EXISTS wawi_quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Verknüpfungen
  quote_id UUID NOT NULL REFERENCES wawi_quotes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  
  -- Position
  position_number INTEGER NOT NULL DEFAULT 1,
  
  -- Artikeldaten (Kopie für Historisierung)
  product_name TEXT NOT NULL,
  product_description TEXT,
  sku TEXT,
  
  -- Mengen & Einheiten
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'Stück',
  
  -- Preise
  purchase_price DECIMAL(12,2) DEFAULT 0,
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  total_price DECIMAL(12,2) DEFAULT 0,
  
  -- Steuern
  tax_rate DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  
  -- Marge
  margin_amount DECIMAL(12,2) DEFAULT 0,
  margin_percentage DECIMAL(5,2) DEFAULT 0,
  
  -- Optionen
  is_package_deal BOOLEAN DEFAULT false,
  show_price BOOLEAN DEFAULT true
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wawi_quote_items_quote ON wawi_quote_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_wawi_quote_items_product ON wawi_quote_items(product_id);

-- ============================================================================
-- RLS POLICIES (Disabled for now)
-- ============================================================================

ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE wawi_quotes DISABLE ROW LEVEL SECURITY;
ALTER TABLE wawi_quote_items DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at on products
CREATE OR REPLACE FUNCTION update_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS products_updated_at ON products;
CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_products_updated_at();

-- Update updated_at on wawi_quotes
DROP TRIGGER IF EXISTS wawi_quotes_updated_at ON wawi_quotes;
CREATE TRIGGER wawi_quotes_updated_at
  BEFORE UPDATE ON wawi_quotes
  FOR EACH ROW
  EXECUTE FUNCTION update_products_updated_at();
