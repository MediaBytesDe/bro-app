-- WAWI Full Schema Migration (1:1 from original WAWI Supabase)
-- Drop old tables and recreate with correct schema

-- ============================================================================
-- DROP OLD TABLES (if exist)
-- ============================================================================
DROP TABLE IF EXISTS wawi_quote_items CASCADE;
DROP TABLE IF EXISTS wawi_quotes CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS product_categories CASCADE;
DROP TABLE IF EXISTS product_units CASCADE;

-- ============================================================================
-- PRODUCT CATEGORIES (hierarchical)
-- ============================================================================
CREATE TABLE product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  parent_id UUID REFERENCES product_categories(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0
);

-- ============================================================================
-- PRODUCT UNITS
-- ============================================================================
CREATE TABLE product_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- PRODUCTS (full schema from WAWI)
-- ============================================================================
CREATE TABLE products (
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
  cost_price DECIMAL(12,2) DEFAULT 0,
  profit_margin DECIMAL(5,2) DEFAULT 30,
  customer_skonto DECIMAL(5,2) DEFAULT 0,
  default_customer_discount DECIMAL(5,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  
  -- Berechnete Preise
  target_purchase_price DECIMAL(12,2) DEFAULT 0,
  bare_purchase_price DECIMAL(12,2) DEFAULT 0,
  reference_price DECIMAL(12,2) DEFAULT 0,
  bare_selling_price DECIMAL(12,2) DEFAULT 0,
  target_selling_price DECIMAL(12,2) DEFAULT 0,
  net_selling_price DECIMAL(12,2) DEFAULT 0,
  gross_selling_price DECIMAL(12,2) DEFAULT 0,
  recommended_retail_price DECIMAL(12,2) DEFAULT 0,
  
  -- Lager & Einheiten
  stock_quantity INTEGER DEFAULT 0,
  min_stock_level INTEGER DEFAULT 0,
  location TEXT DEFAULT '',
  unit TEXT DEFAULT 'Stück',
  standard_quantity DECIMAL(10,2) DEFAULT 1,
  
  -- Status & Integration
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'discontinued', 'out_of_stock')),
  lexware_article_id TEXT
);

CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_status ON products(status);

-- ============================================================================
-- WAWI QUOTES (full schema from WAWI)
-- ============================================================================
CREATE TABLE wawi_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Verknüpfungen
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  
  -- Angebotsnummern
  quote_number TEXT,
  lexware_quote_number TEXT,
  lexware_quotation_id TEXT,
  
  -- Datum & Gültigkeit
  quote_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,
  
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent_to_lexware', 'sent', 'accepted', 'rejected', 'expired', 'open')),
  
  -- Beträge
  subtotal DECIMAL(12,2) DEFAULT 0,
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  discount_amount DECIMAL(12,2) DEFAULT 0,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) DEFAULT 0,
  total_margin DECIMAL(12,2) DEFAULT 0,
  margin_percentage DECIMAL(5,2) DEFAULT 0,
  rounding_amount DECIMAL(12,2) DEFAULT 0,
  
  -- Texte
  title TEXT DEFAULT 'Angebot',
  introduction TEXT,
  remark TEXT,
  notes TEXT,
  internal_notes TEXT,
  
  -- Optionen
  is_package_deal BOOLEAN DEFAULT false,
  tax_type TEXT DEFAULT 'standard'
);

CREATE INDEX idx_wawi_quotes_customer ON wawi_quotes(customer_id);
CREATE INDEX idx_wawi_quotes_status ON wawi_quotes(status);
CREATE INDEX idx_wawi_quotes_date ON wawi_quotes(quote_date);

-- ============================================================================
-- WAWI QUOTE ITEMS (full schema from WAWI)
-- ============================================================================
CREATE TABLE wawi_quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Verknüpfungen
  quote_id UUID NOT NULL REFERENCES wawi_quotes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  
  -- Position
  position_number INTEGER NOT NULL DEFAULT 1,
  
  -- Artikeldaten
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
  
  -- Marge
  margin_amount DECIMAL(12,2) DEFAULT 0,
  margin_percentage DECIMAL(5,2) DEFAULT 0,
  
  -- Steuern
  tax_rate DECIMAL(5,2) DEFAULT 0,
  tax_amount DECIMAL(12,2) DEFAULT 0,
  
  -- Optionen
  is_package_deal BOOLEAN DEFAULT false
);

CREATE INDEX idx_wawi_quote_items_quote ON wawi_quote_items(quote_id);
CREATE INDEX idx_wawi_quote_items_product ON wawi_quote_items(product_id);

-- ============================================================================
-- RLS DISABLED
-- ============================================================================
ALTER TABLE product_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE product_units DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE wawi_quotes DISABLE ROW LEVEL SECURITY;
ALTER TABLE wawi_quote_items DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- TRIGGERS
-- ============================================================================
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER wawi_quotes_updated_at BEFORE UPDATE ON wawi_quotes
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER product_categories_updated_at BEFORE UPDATE ON product_categories
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();
