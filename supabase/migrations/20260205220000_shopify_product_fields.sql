-- Add Shopify integration fields to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS source_url TEXT,
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS source_product_id TEXT,
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;

-- Create index for URL lookups (AI agent will use this)
CREATE INDEX IF NOT EXISTS idx_products_source_url ON products(source_url);

-- Create index for source type filtering
CREATE INDEX IF NOT EXISTS idx_products_source_type ON products(source_type);

-- Add comment for documentation
COMMENT ON COLUMN products.source_url IS 'External source URL (e.g., Shopify product page) for price sync';
COMMENT ON COLUMN products.source_type IS 'Source of product: manual, shopify, lexware';
COMMENT ON COLUMN products.source_product_id IS 'External product ID from source system';
COMMENT ON COLUMN products.image_url IS 'URL to main product image';
COMMENT ON COLUMN products.last_sync_at IS 'Timestamp of last successful sync from external source';
