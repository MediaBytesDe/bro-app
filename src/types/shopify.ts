/**
 * Shopify API Type Definitions
 * Based on Shopify JSON API structure
 */

export interface ShopifyProduct {
  id: number;
  title: string;
  body_html: string;
  vendor: string;
  product_type: string;
  created_at: string;
  updated_at: string;
  published_at: string;
  tags: string[];
  variants: ShopifyVariant[];
  options: ShopifyOption[];
  images: ShopifyImage[];
  image?: ShopifyImage;
}

export interface ShopifyVariant {
  id: number;
  product_id: number;
  title: string;
  price: string;
  compare_at_price: string | null;
  sku: string;
  position: number;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  taxable: boolean;
  inventory_management: string;
  grams: number;
  weight: number;
  weight_unit: string;
  requires_shipping: boolean;
}

export interface ShopifyOption {
  id: number;
  product_id: number;
  name: string;
  position: number;
  values: string[];
}

export interface ShopifyImage {
  id: number;
  product_id: number;
  position: number;
  created_at: string;
  updated_at: string;
  alt: string | null;
  width: number;
  height: number;
  src: string;
  variant_ids: number[];
}

export interface ShopifyProductResponse {
  product: ShopifyProduct;
}
