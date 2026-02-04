// WAWI Types - Products & Quotes

export type Product = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  description: string | null;
  category: string;
  manufacturer: string | null;
  sku: string;
  purchase_list_price: number;
  supplier_discount: number;
  supplier_skonto: number;
  purchase_costs: number;
  overhead_percentage: number;
  profit_margin: number;
  customer_skonto: number;
  default_customer_discount: number;
  tax_rate: number;
  target_purchase_price: number;
  bare_purchase_price: number;
  reference_price: number;
  cost_price: number;
  bare_selling_price: number;
  target_selling_price: number;
  net_selling_price: number;
  gross_selling_price: number;
  recommended_retail_price: number;
  stock_quantity: number;
  min_stock_level: number;
  unit: string;
  standard_quantity: number;
  status: 'active' | 'discontinued' | 'out_of_stock';
};

export type WawiQuote = {
  id: string;
  created_at: string;
  updated_at: string;
  customer_id: string | null;
  quote_number: string | null;
  lexware_quote_number: string | null;
  lexware_quotation_id: string | null;
  quote_date: string;
  valid_until: string | null;
  status: 'draft' | 'sent_to_lexware' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'open';
  subtotal: number;
  total_margin: number;
  margin_percentage: number;
  rounding_amount: number;
  title: string | null;
  introduction: string | null;
  remark: string | null;
  is_package_deal: boolean;
  tax_type: string;
  discount_percentage: number;
  discount_amount: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  package_rounding: boolean;
  rounded_total: number | null;
  introduction_text: string | null;
  footer_text: string | null;
  notes: string | null;
  internal_notes: string | null;
  // Joins
  customer?: {
    id: string;
    company_name: string | null;
    first_name: string | null;
    last_name: string | null;
  };
  project?: {
    id: string;
    name: string;
  };
};

export type WawiQuoteItem = {
  id?: string;
  _id?: string; // für Drag & Drop
  quote_id?: string;
  product_id: string | null;
  position_number: number;
  product_name: string;
  product_description: string | null;
  sku: string | null;
  quantity: number;
  unit: string;
  purchase_price: number;
  unit_price: number;
  discount_percentage: number;
  total_price: number;
  tax_rate: number;
  tax_amount: number;
  margin_amount: number;
  margin_percentage: number;
  is_package_deal: boolean;
  show_price: boolean;
};

// Kategorien für Produkte (müssen mit DB übereinstimmen)
export const PRODUCT_CATEGORIES = [
  { id: 'Trina Solar', label: 'Solarmodule' },
  { id: 'Wechselrichter', label: 'Wechselrichter' },
  { id: 'Speicher', label: 'Speicher' },
  { id: 'Aufdach-Montage', label: 'Aufdach-Montage' },
  { id: 'DC Montage', label: 'DC Montage' },
  { id: 'AC Montage', label: 'AC Montage' },
  { id: 'Inbetriebnahme', label: 'Inbetriebnahme' },
  { id: 'Zubehör', label: 'Zubehör' },
] as const;

// Status für Angebote
export const QUOTE_STATUSES = {
  draft: { label: 'Entwurf', color: 'gray' },
  sent_to_lexware: { label: 'An Lexware', color: 'blue' },
  sent: { label: 'Versendet', color: 'cyan' },
  open: { label: 'Offen', color: 'yellow' },
  accepted: { label: 'Angenommen', color: 'green' },
  rejected: { label: 'Abgelehnt', color: 'red' },
  expired: { label: 'Abgelaufen', color: 'neutral' },
} as const;

// Formatierung
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

// Berechnung: Runden auf X.X99
export function roundToX99(value: number): number {
  const rounded = Math.ceil(value / 100) * 100 - 1;
  return rounded < value ? rounded + 100 : rounded;
}

// Quote Template
export type QuoteTemplate = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  description: string | null;
  category: string | null;
  items: QuoteTemplateItem[];
  introduction_text: string | null;
  footer_text: string | null;
  is_active: boolean;
  sort_order: number;
};

export type QuoteTemplateItem = {
  product_id: string | null;
  product_name: string;
  product_description: string | null;
  sku: string | null;
  quantity: number;
  quantity_per_kwp: number | null; // Falls Menge pro kWp berechnet werden soll
  unit: string;
  unit_price: number;
  price_per_kwp: number | null; // Falls Preis pro kWp
  tax_rate: number;
  is_optional: boolean; // Kann vom Nutzer entfernt werden
  is_required: boolean; // Muss immer dabei sein
};

// Berechnung: Quote Item Totals
export function calculateItemTotal(item: Partial<WawiQuoteItem>): {
  total_price: number;
  tax_amount: number;
  margin_amount: number;
  margin_percentage: number;
} {
  const quantity = item.quantity || 0;
  const unitPrice = item.unit_price || 0;
  const discount = item.discount_percentage || 0;
  const purchasePrice = item.purchase_price || 0;
  const taxRate = item.tax_rate || 0;

  const subtotal = quantity * unitPrice;
  const discountAmount = subtotal * (discount / 100);
  const total_price = subtotal - discountAmount;
  const tax_amount = total_price * (taxRate / 100);
  const margin_amount = total_price - (quantity * purchasePrice);
  // Marge = Gewinn / Verkaufspreis (echter Gewinnanteil)
  const margin_percentage = total_price > 0 
    ? (margin_amount / total_price) * 100 
    : 0;

  return {
    total_price,
    tax_amount,
    margin_amount,
    margin_percentage,
  };
}
