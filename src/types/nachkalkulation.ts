// Nachkalkulation Types - Post-Calculation Feature

// Enums matching DB
export type CostType = "subcontractor_invoice" | "material" | "overhead" | "other";
export type CostStatus = "pending" | "verified" | "disputed";
export type CalculationStatus = "open" | "in_review" | "closed";
export type MaterialDirection = "outgoing" | "returning";

// DB Row types
export interface ProjectCost {
  id: string;
  project_id: string;
  quote_id: string | null;
  quote_line_item_key: string | null;
  cost_type: CostType;
  description: string;
  amount: number;
  date: string;
  subcontractor_id: string | null;
  invoice_id: string | null;
  status: CostStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined relations
  subcontractor?: { company_name: string; trade: string };
  invoice?: { invoice_number: string; file_url: string; amount: number };
}

export interface MaterialMovement {
  id: string;
  product_id: string;
  project_id: string;
  subcontractor_id: string | null;
  quote_line_item_key: string | null;
  direction: MaterialDirection;
  quantity: number;
  unit_price: number;
  date: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  // Joined relations
  product?: { name: string; sku: string; unit: string; purchase_list_price: number };
  subcontractor?: { company_name: string };
}

export interface OverheadSettings {
  id: string;
  year: number;
  planned_revenue: number;
  planned_overhead_costs: number;
  overhead_percentage: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectCalculationStatus {
  id: string;
  project_id: string;
  status: CalculationStatus;
  closed_at: string | null;
  closed_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Aggregated view types for Nachkalkulation UI
export interface PositionCostSummary {
  line_item_key: string;
  position_number: number;
  product_name: string;
  soll: number;           // Kalkulierter Betrag aus Angebot
  ist: number;            // Summe aller Ist-Kosten
  differenz: number;      // soll - ist (positive = under budget)
  costs: ProjectCost[];
  material_costs: number; // Aus material_movements berechnet
}

export interface ProjectCostSummary {
  project_id: string;
  quote_total: number;      // Gesamter Angebotswert
  total_costs: number;      // Alle Ist-Kosten
  overhead_amount: number;  // Gemeinkosten
  profit: number;           // quote_total - total_costs - overhead
  margin_percent: number;   // (profit / quote_total) * 100
  positions: PositionCostSummary[];
  open_items: OpenItem[];
}

export interface OpenItem {
  type: "missing_invoice" | "unreturned_material" | "pending_cost";
  description: string;
}
