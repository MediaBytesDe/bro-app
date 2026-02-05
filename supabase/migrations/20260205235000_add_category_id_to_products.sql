-- Add category_id foreign key to products table
-- This properly links products to their exact category, even if names are duplicated

-- Step 1: Add nullable category_id column
ALTER TABLE products
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES product_categories(id) ON DELETE SET NULL;

-- Step 2: Migrate existing data - match category names to IDs
-- For products with duplicate category names, we'll need manual intervention
UPDATE products p
SET category_id = (
  SELECT id
  FROM product_categories pc
  WHERE pc.name = p.category
  LIMIT 1
)
WHERE p.category IS NOT NULL AND p.category != '';

-- Step 3: Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);

-- Step 4: Add comment
COMMENT ON COLUMN products.category_id IS 'Foreign key to product_categories table - use this instead of category text field';

-- Note: We keep the category TEXT field for backward compatibility and as fallback
-- but new code should use category_id
