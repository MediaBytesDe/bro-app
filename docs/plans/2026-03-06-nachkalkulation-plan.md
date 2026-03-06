# Nachkalkulation & Kosten-Tracking — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Track quotes vs actual costs per project/position with material flow, overhead allocation, and profit statistics.

**Architecture:** New DB tables (`project_costs`, `material_movements`, `overhead_settings`, `project_calculation_status`) with triggers for automatic stock updates. New API routes for cost management. New tabs in WorkfolderDetail for cost tracking and material. New pages for invoice inbox, statistics, and overhead settings. Dashboard widgets for KPIs.

**Tech Stack:** Next.js 15, Supabase (PostgreSQL), Tailwind CSS, Recharts, Lucide Icons, Sonner (toasts)

**Design Doc:** `docs/plans/2026-03-06-nachkalkulation-design.md`

---

## Task 1: Database Migration — New Tables & Triggers

**Files:**
- Create: `supabase/migrations/20260306_nachkalkulation.sql`

**Step 1: Write the migration**

```sql
-- ============================================================
-- Nachkalkulation & Kosten-Tracking
-- ============================================================

-- Enums
CREATE TYPE cost_type AS ENUM ('subcontractor_invoice', 'material', 'overhead', 'other');
CREATE TYPE cost_status AS ENUM ('pending', 'verified', 'disputed');
CREATE TYPE calculation_status AS ENUM ('open', 'in_review', 'closed');
CREATE TYPE material_direction AS ENUM ('outgoing', 'returning');

-- ============================================================
-- Overhead Settings (per year)
-- ============================================================
CREATE TABLE overhead_settings (
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

-- ============================================================
-- Project Costs
-- ============================================================
CREATE TABLE project_costs (
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

CREATE INDEX idx_project_costs_project ON project_costs(project_id);
CREATE INDEX idx_project_costs_quote ON project_costs(quote_id);
CREATE INDEX idx_project_costs_invoice ON project_costs(invoice_id);

-- ============================================================
-- Material Movements
-- ============================================================
CREATE TABLE material_movements (
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

CREATE INDEX idx_material_movements_project ON material_movements(project_id);
CREATE INDEX idx_material_movements_product ON material_movements(product_id);

-- Trigger: Auto-update stock_quantity on products
CREATE OR REPLACE FUNCTION update_stock_on_material_movement()
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

CREATE TRIGGER trg_material_movement_stock
  AFTER INSERT ON material_movements
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_on_material_movement();

-- ============================================================
-- Project Calculation Status
-- ============================================================
CREATE TABLE project_calculation_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  status calculation_status NOT NULL DEFAULT 'open',
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- updated_at triggers
-- ============================================================
CREATE TRIGGER set_updated_at_overhead_settings
  BEFORE UPDATE ON overhead_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_project_costs
  BEFORE UPDATE ON project_costs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at_project_calculation_status
  BEFORE UPDATE ON project_calculation_status
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- RLS Policies
-- ============================================================
ALTER TABLE overhead_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_calculation_status ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read/write all (admin-only in practice via API)
CREATE POLICY "authenticated_all" ON overhead_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON project_costs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON material_movements FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all" ON project_calculation_status FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Service role (API routes)
CREATE POLICY "service_all" ON overhead_settings FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON project_costs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON material_movements FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON project_calculation_status FOR ALL TO service_role USING (true) WITH CHECK (true);
```

**Step 2: Run the migration**

```bash
# Connect to Supabase and run the migration
# (use the same method as existing migrations in the project)
```

**Step 3: Commit**

```bash
git add supabase/migrations/20260306_nachkalkulation.sql
git commit -m "feat: add nachkalkulation database tables and triggers"
```

---

## Task 2: TypeScript Types

**Files:**
- Create: `src/types/nachkalkulation.ts`

**Step 1: Create types file**

```typescript
export type CostType = "subcontractor_invoice" | "material" | "overhead" | "other";
export type CostStatus = "pending" | "verified" | "disputed";
export type CalculationStatus = "open" | "in_review" | "closed";
export type MaterialDirection = "outgoing" | "returning";

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

// Aggregated view for Nachkalkulation UI
export interface PositionCostSummary {
  line_item_key: string;
  position_number: number;
  product_name: string;
  soll: number; // Kalkulierter Betrag aus Angebot
  ist: number;  // Summe aller Ist-Kosten
  differenz: number;
  costs: ProjectCost[];
  material_costs: number; // Aus material_movements berechnet
}

export interface ProjectCostSummary {
  project_id: string;
  quote_total: number;       // Gesamter Angebotswert
  total_costs: number;       // Alle Ist-Kosten
  overhead_amount: number;   // Gemeinkosten
  profit: number;            // quote_total - total_costs - overhead
  margin_percent: number;    // (profit / quote_total) * 100
  positions: PositionCostSummary[];
  open_items: OpenItem[];
}

export interface OpenItem {
  type: "missing_invoice" | "unreturned_material" | "pending_cost";
  description: string;
}
```

**Step 2: Commit**

```bash
git add src/types/nachkalkulation.ts
git commit -m "feat: add TypeScript types for nachkalkulation"
```

---

## Task 3: API Route — Project Costs

**Files:**
- Create: `src/app/api/costs/route.ts`

**Reference:** Follow the pattern from `src/app/api/inquiries/route.ts` — action-based POST handler with admin client for RLS bypass.

**Step 1: Create the API route**

Actions to implement:
- `list` — Get all costs for a project (with relations)
- `create` — Add a new cost entry
- `update` — Update cost status/amount/notes
- `delete` — Remove a cost entry
- `summary` — Get aggregated cost summary for nachkalkulation view
- `assign_invoice` — Link a partner_invoice to project + position(s)

```typescript
// Pattern:
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const body = await req.json();
  const { action } = body;

  switch (action) {
    case "list": { /* query project_costs with joins */ }
    case "create": { /* insert into project_costs */ }
    case "update": { /* update project_costs */ }
    case "delete": { /* delete from project_costs */ }
    case "summary": { /* aggregate costs + material + overhead per position */ }
    case "assign_invoice": { /* link partner_invoice → project_costs entries */ }
    default: return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
```

The `summary` action is the most complex — it must:
1. Fetch the project's accepted quote with `wawi_quote_items`
2. Fetch all `project_costs` for the project
3. Fetch all `material_movements` for the project, calculate net consumption per position
4. Fetch current year's `overhead_settings` for overhead percentage
5. Calculate per-position soll/ist, total costs, overhead, profit, margin
6. Identify open items (positions without costs, unreturned material, pending invoices)

**Step 2: Commit**

```bash
git add src/app/api/costs/route.ts
git commit -m "feat: add project costs API route"
```

---

## Task 4: API Route — Material Movements

**Files:**
- Create: `src/app/api/material/route.ts`

**Step 1: Create the API route**

Actions:
- `list` — Get movements for a project (with product relations)
- `create` — New movement (outgoing/returning). Auto-fills `unit_price` from `products.purchase_list_price`
- `project_summary` — Net consumption per product for a project
- `low_stock` — Products where `stock_quantity <= min_stock_level`

**Step 2: Commit**

```bash
git add src/app/api/material/route.ts
git commit -m "feat: add material movements API route"
```

---

## Task 5: API Route — Overhead Settings

**Files:**
- Create: `src/app/api/overhead/route.ts`

**Step 1: Create the API route**

Actions:
- `get` — Get settings for current year (or specific year)
- `upsert` — Create or update overhead settings for a year

**Step 2: Commit**

```bash
git add src/app/api/overhead/route.ts
git commit -m "feat: add overhead settings API route"
```

---

## Task 6: API Route — Calculation Status

**Files:**
- Create: `src/app/api/calculation-status/route.ts`

**Step 1: Create the API route**

Actions:
- `get` — Get status for a project
- `update` — Change status (open → in_review → closed), set closed_at/closed_by
- `list_open` — All projects with open/in_review calculations (for dashboard widget)

**Step 2: Commit**

```bash
git add src/app/api/calculation-status/route.ts
git commit -m "feat: add calculation status API route"
```

---

## Task 7: Nachkalkulation Tab — WorkfolderDetail

**Files:**
- Modify: `src/components/workfolder-detail.tsx` (add tab to tabs array at line ~730)
- Create: `src/components/nachkalkulation-tab.tsx`

**Step 1: Add tab to WorkfolderDetail**

In `workfolder-detail.tsx`, add to the `TabType` type (line ~108):
```typescript
type TabType = "overview" | "appointments" | "subcontractors" | "documents" | "gallery" | "forms" | "quotes" | "tasks" | "inquiries" | "nachkalkulation";
```

Add to the `tabs` array (line ~730):
```typescript
{ id: "nachkalkulation", label: "Kalkulation", icon: Receipt, count: 0 },
```

Add the tab content rendering (after the other tab sections):
```typescript
{activeTab === "nachkalkulation" && (
  <NachkalkulationTab projectId={project.id} quoteId={acceptedQuote?.id} />
)}
```

**Step 2: Create NachkalkulationTab component**

`src/components/nachkalkulation-tab.tsx` — Main component showing:

**Layout:**
```
┌──────────────────────────────────────────────────┐
│ Status: ● Offen    [Status ändern ▼]             │
├──────────────────────────────────────────────────┤
│ Angebotssumme: 12.500€                           │
│                                                   │
│ Position        Soll      Ist      Diff    Status │
│ ──────────────────────────────────────────────── │
│ DC-Montage      2.100€    1.950€   +150€   ✅   │
│  └ Sub: Müller            1.200€                 │
│  └ Material               750€                   │
│ AC-Montage      1.300€    1.845€   -545€   ⚠️   │
│  └ Sub: Müller            970€                   │
│  └ Material               875€                   │
│ ...                                               │
│ ──────────────────────────────────────────────── │
│ Zwischensumme   12.500€   11.745€  +755€        │
│ Gemeinkosten (12%)                  1.410€        │
│ ──────────────────────────────────────────────── │
│ Gesamtkosten                       13.155€        │
│ Gewinn                              -655€ ⚠️      │
│ Marge                               -5,2%         │
│                                                   │
│ Offene Posten:                                    │
│ ⚠ "Sonstiges" — kein Kosten zugeordnet          │
│ ⚠ 13 Dachhaken nicht zurückgebucht               │
│                                                   │
│ [+ Kosten hinzufügen]  [Abschließen]             │
└──────────────────────────────────────────────────┘
```

**Data flow:**
1. Call `/api/costs` with action `summary` to get `ProjectCostSummary`
2. Call `/api/calculation-status` with action `get`
3. Render the position table with expandable rows
4. Modal for adding costs (type selector, amount, description, position dropdown)
5. Modal for closing calculation (shows open items, confirmation)

**Key interactions:**
- Click on position row to expand and see individual cost entries
- "Kosten hinzufügen" button opens modal with: cost_type selector, amount, description, quote_line_item dropdown, optional sub dropdown
- Status badge with dropdown to change calculation status
- "Abschließen" shows open items warning, confirms close

**Step 3: Commit**

```bash
git add src/components/workfolder-detail.tsx src/components/nachkalkulation-tab.tsx
git commit -m "feat: add nachkalkulation tab to project detail"
```

---

## Task 8: Material Tab — WorkfolderDetail

**Files:**
- Modify: `src/components/workfolder-detail.tsx` (add tab)
- Create: `src/components/material-tab.tsx`

**Step 1: Add tab to WorkfolderDetail**

Add to `TabType` and tabs array:
```typescript
{ id: "material", label: "Material", icon: Package, count: materialMovements.length },
```

**Step 2: Create MaterialTab component**

`src/components/material-tab.tsx`:

**Layout:**
```
┌──────────────────────────────────────────────────┐
│ [+ Material ausgeben]  [+ Rückgabe]              │
├──────────────────────────────────────────────────┤
│ Verbrauch Übersicht:                             │
│ Artikel          Ausgabe  Rückgabe  Verbrauch    │
│ Dachhaken        50       13        37 Stk       │
│ AC-Kabel         100m     0m        100m         │
│ Wechselrichter   3        0         3 Stk        │
│ ──────────────────────────────────────────────── │
│ Materialkosten gesamt: 2.450€                    │
│                                                   │
│ Bewegungen:                                       │
│ 05.03. ↗ 50x Dachhaken → Sub Müller             │
│ 05.03. ↗ 100m AC-Kabel → Sub Müller             │
│ 06.03. ↙ 13x Dachhaken ← Sub Müller             │
└──────────────────────────────────────────────────┘
```

**Ausgabe-Modal:**
- Product search (from products table, like in quote editor)
- Quantity input
- Sub dropdown (from project's assigned subs)
- Optional: Angebotsposition zuordnen
- Date

**Rückgabe-Modal:**
- Product dropdown (only products previously issued to this project)
- Quantity (max = outstanding quantity)
- Sub dropdown
- Date

**Step 3: Commit**

```bash
git add src/components/workfolder-detail.tsx src/components/material-tab.tsx
git commit -m "feat: add material tracking tab to project detail"
```

---

## Task 9: Rechnungs-Inbox Page

**Files:**
- Create: `src/app/(app)/rechnungen/page.tsx`
- Modify: `src/components/app-shell.tsx` (add navigation entry)

**Step 1: Add nav entry in AppShell**

Add to the navigation items in `app-shell.tsx`:
```typescript
{ href: "/rechnungen", label: "Rechnungen", icon: Receipt }
```

**Step 2: Create Rechnungs-Inbox page**

`src/app/(app)/rechnungen/page.tsx`:

**Layout:**
```
┌──────────────────────────────────────────────────────┐
│ Rechnungs-Inbox                                       │
│ Filter: [Alle ▼] [Unzugeordnet ▼]                   │
├──────────────────────────────────────────────────────┤
│ Status    Partner       Betrag    Datum    Projekt    │
│ ──────────────────────────────────────────────────── │
│ ● Neu    Elektro Müller 1.450€  05.03.   [Zuordnen] │
│ ● Neu    Dach GmbH      3.200€  04.03.   [Zuordnen] │
│ ✓ OK     Gerüst AG       800€   01.03.   Schulze PV │
│ ──────────────────────────────────────────────────── │
└──────────────────────────────────────────────────────┘
```

**Data flow:**
1. Fetch all `partner_invoices` with partner and project relations
2. Filter by status (uploaded/reviewed/approved/paid) and assignment status
3. "Zuordnen" button opens assignment modal

**Assignment Modal:**
- Project dropdown (search)
- Once project selected: show quote positions as checkboxes
- Amount split per position (if invoice covers multiple positions)
- Creates `project_costs` entries with `cost_type: 'subcontractor_invoice'`
- Updates `partner_invoices.status` to 'reviewed'
- Links via `invoice_id` foreign key

**Step 3: Commit**

```bash
git add src/app/\(app\)/rechnungen/page.tsx src/components/app-shell.tsx
git commit -m "feat: add invoice inbox page with project assignment"
```

---

## Task 10: Gemeinkosten-Einstellungen

**Files:**
- Create: `src/app/(app)/einstellungen/page.tsx`
- Modify: `src/components/app-shell.tsx` (add nav entry if not exists)

**Step 1: Create Settings page**

Simple form:
```
┌────────────────────────────────────┐
│ Einstellungen                       │
├────────────────────────────────────┤
│ Gemeinkosten-Kalkulation            │
│                                     │
│ Jahr:           [2026     ▼]       │
│ Geplanter Umsatz: [1.500.000 €]   │
│ Gemeinkosten:     [  180.000 €]   │
│ Zuschlag:         12,00 % (auto)   │
│                                     │
│ [Speichern]                         │
│                                     │
│ Historie:                           │
│ 2026: 12,00% (180k / 1.500k)      │
│ 2025: 11,50% (161k / 1.400k)      │
└────────────────────────────────────┘
```

**Step 2: Commit**

```bash
git add src/app/\(app\)/einstellungen/page.tsx
git commit -m "feat: add overhead settings page"
```

---

## Task 11: Dashboard Widgets — Profit KPIs

**Files:**
- Create: `src/components/dashboard/profit-kpi-section.tsx`
- Modify: `src/components/dashboard.tsx` (add the new section)

**Step 1: Create ProfitKPISection**

`src/components/dashboard/profit-kpi-section.tsx`:

**Data to fetch:**
- All `project_costs` for current month
- Accepted quotes for projects with costs
- Current year `overhead_settings`
- Products with `stock_quantity <= min_stock_level`
- Count of projects with `project_calculation_status.status != 'closed'`

**Widgets:**
```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Gewinn Monat  │ │ Ø Marge      │ │ Offene Kalk. │ │ Lager ⚠️     │
│   +4.230€    │ │   8,3%       │ │ 7 Projekte   │ │ 3 Artikel    │
│ ▲ +12% vs VM │ │              │ │              │ │ nachbestellen│
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

Follow the pattern from `src/components/dashboard/kpi-section.tsx` — use `createClient()`, `useEffect` + `Promise.all` for parallel data loading.

**Step 2: Add to Dashboard**

In `dashboard.tsx`, import and render `<ProfitKPISection />` above or below the existing `<KPISection />`.

**Step 3: Commit**

```bash
git add src/components/dashboard/profit-kpi-section.tsx src/components/dashboard.tsx
git commit -m "feat: add profit KPI widgets to dashboard"
```

---

## Task 12: Statistik-Seite

**Files:**
- Create: `src/app/(app)/statistiken/page.tsx`
- Create: `src/components/statistics-page.tsx`
- Modify: `src/components/app-shell.tsx` (add nav entry)

**Step 1: Add nav entry**

```typescript
{ href: "/statistiken", label: "Statistiken", icon: BarChart3 }
```

**Step 2: Create StatisticsPage component**

`src/components/statistics-page.tsx`:

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│ Statistiken         [Woche|Monat|Quartal|Jahr|Custom]│
├─────────────────────────────────────────────────────┤
│                                                      │
│ ┌─────────────────────┐ ┌─────────────────────┐     │
│ │ Gewinn-Trend (Linie)│ │ Kostenverteilung    │     │
│ │ Recharts LineChart  │ │ Recharts PieChart   │     │
│ │ X: Monat, Y: EUR   │ │ Sub/Material/Gemein │     │
│ └─────────────────────┘ └─────────────────────┘     │
│                                                      │
│ ┌─────────────────────┐ ┌─────────────────────┐     │
│ │ Marge pro Projekt   │ │ Soll/Ist Vergleich  │     │
│ │ Recharts BarChart   │ │ Grouped BarChart    │     │
│ │ sortiert nach Marge │ │ pro Projekt         │     │
│ └─────────────────────┘ └─────────────────────┘     │
│                                                      │
│ Tabellen:                                            │
│ ┌─────────────────────────────────────────────┐     │
│ │ Top/Flop Projekte | Sub-Performance | Gewerk│     │
│ └─────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────┘
```

**API route for statistics:**
- Create: `src/app/api/statistics/route.ts`
- Actions: `profit_trend`, `cost_distribution`, `project_margins`, `sub_performance`, `trade_performance`

**Recharts usage** (follow pattern from `kpi-section.tsx`):
```typescript
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from "recharts";
```

**Step 3: Commit**

```bash
git add src/app/\(app\)/statistiken/page.tsx src/components/statistics-page.tsx src/app/api/statistics/route.ts src/components/app-shell.tsx
git commit -m "feat: add statistics page with profit charts"
```

---

## Task Summary & Dependencies

```
Task 1: DB Migration (no deps)
Task 2: TypeScript Types (no deps)
Task 3: API Costs (depends on 1, 2)
Task 4: API Material (depends on 1, 2)
Task 5: API Overhead (depends on 1, 2)
Task 6: API Calc Status (depends on 1, 2)
Task 7: Nachkalkulation Tab (depends on 3, 5, 6)
Task 8: Material Tab (depends on 4)
Task 9: Rechnungs-Inbox (depends on 3)
Task 10: Overhead Settings (depends on 5)
Task 11: Dashboard Widgets (depends on 3, 4, 5, 6)
Task 12: Statistik-Seite (depends on 3, 4, 5)
```

**Parallelisierbar:**
- Tasks 1 + 2 parallel
- Tasks 3, 4, 5, 6 parallel (after 1+2)
- Tasks 7, 8, 9, 10 parallel (after their API deps)
- Tasks 11, 12 last (need all APIs)
