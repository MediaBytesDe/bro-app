# Nachkalkulation & Kosten-Tracking — Design

**Datum:** 2026-03-06
**Status:** Approved

## Ziel

Tracking von Angeboten vs. realen Kosten (Sub-Rechnungen, Materialverbrauch, Gemeinkosten) pro Projekt und Angebotsposition. Daraus exakte Gewinnermittlung und Statistiken (Woche/Monat/Jahr).

## Scope

### In Scope (Phase 1)
- Nachkalkulation pro Projekt und pro Angebotsposition
- Sub-Rechnungen dem Projekt/Positionen zuordnen (aus Partner-Portal Upload)
- Materialfluss: Lager → Projekt/Sub, Rückgabe, automatische Lagerbestandspflege
- Nachbestellwarnung bei Mindestbestand
- Gemeinkosten-Umlage via pauschaler Prozentsatz (basierend auf geplantem Jahresumsatz)
- Soll/Ist-Vergleich pro Angebotsposition
- Nachkalkulations-Abschluss mit offene-Posten-Prüfung
- Dashboard-Widgets (Gewinn, Marge, offene Nachkalkulationen, Lagerwarnung)
- Statistik-Seite mit Diagrammen und Drill-Down

### Out of Scope (Phase 2)
- Eigene Arbeitszeiterfassung
- Lexware-Import von Eingangsrechnungen
- Automatische Nachbestellung bei Mindestbestand
- Fortgeschrittene Gemeinkosten-Umlage (zeitbasiert, umsatzbasiert)

## Datenmodell

### Neue Tabellen

#### `project_costs`
Zentrale Kostentabelle pro Projekt.

| Spalte | Typ | Beschreibung |
|---|---|---|
| id | UUID PK | |
| project_id | UUID FK → projects | Projektzuordnung |
| quote_id | UUID FK → quotes (optional) | Angebotszuordnung |
| quote_line_item_key | TEXT (optional) | Referenz auf Position im Angebot-JSONB |
| cost_type | ENUM | `subcontractor_invoice`, `material`, `overhead`, `other` |
| description | TEXT | Beschreibung der Kosten |
| amount | DECIMAL(12,2) | Betrag in EUR |
| date | DATE | Kostendatum |
| subcontractor_id | UUID FK → subcontractors (optional) | Bei Sub-Rechnungen |
| document_id | UUID FK → documents (optional) | Verknüpfte Rechnung |
| status | ENUM | `pending`, `verified`, `disputed` |
| notes | TEXT (optional) | Notizen, z.B. bei Disputed |
| created_by | UUID FK → users | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

#### `material_movements`
Materialfluss zwischen Lager und Projekten/Subs.

| Spalte | Typ | Beschreibung |
|---|---|---|
| id | UUID PK | |
| product_id | UUID FK → products | Artikel aus WAWI |
| project_id | UUID FK → projects | Projektzuordnung |
| subcontractor_id | UUID FK → subcontractors (optional) | An welchen Sub ausgegeben |
| quote_line_item_key | TEXT (optional) | Zuordnung zur Angebotsposition |
| direction | ENUM | `outgoing` (Lager→Projekt) oder `returning` (Projekt→Lager) |
| quantity | DECIMAL(10,2) | Menge |
| unit_price | DECIMAL(12,2) | Stückpreis zum Zeitpunkt der Bewegung |
| date | DATE | Datum der Bewegung |
| notes | TEXT (optional) | |
| created_by | UUID FK → users | |
| created_at | TIMESTAMPTZ | |

DB-Trigger: Aktualisiert `products.stock_quantity` automatisch bei INSERT.

#### `overhead_settings`
Gemeinkosten-Konfiguration pro Jahr.

| Spalte | Typ | Beschreibung |
|---|---|---|
| id | UUID PK | |
| year | INTEGER UNIQUE | Geschäftsjahr |
| planned_revenue | DECIMAL(14,2) | Geplanter Jahresumsatz |
| planned_overhead_costs | DECIMAL(14,2) | Geplante Gemeinkosten |
| overhead_percentage | DECIMAL(5,2) | Berechnet: overhead / revenue * 100 |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

#### `project_calculation_status`
Nachkalkulations-Status pro Projekt.

| Spalte | Typ | Beschreibung |
|---|---|---|
| id | UUID PK | |
| project_id | UUID FK → projects UNIQUE | |
| status | ENUM | `open`, `in_review`, `closed` |
| closed_at | TIMESTAMPTZ (optional) | |
| closed_by | UUID FK → users (optional) | |
| notes | TEXT (optional) | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### Bestehende Tabellen
- `products` — `stock_quantity` und `min_stock_level` existieren bereits, werden durch `material_movements` Trigger automatisch gepflegt

## Materialfluss

### Workflow
```
Lager → Projekt/Sub:
  "50 Dachhaken an Sub Müller für Projekt Schulze ausgeben"
  → material_movement (outgoing, qty: 50)
  → stock_quantity -= 50

Sub/Projekt → Lager:
  "13 Dachhaken zurück von Sub Müller"
  → material_movement (returning, qty: 13)
  → stock_quantity += 13

Verbrauch = Summe outgoing - Summe returning = 37 Dachhaken
Kosten = 37 * unit_price → automatisch als Materialkosten in Nachkalkulation
```

### Nachbestellwarnung
- Wenn `stock_quantity` <= `min_stock_level` → Warnung auf Dashboard + Artikelübersicht
- Kein automatisches Bestellen, nur Hinweis

## Sub-Rechnungen & Kostenzuordnung

### Workflow
```
Partner lädt Rechnung hoch (existiert bereits im Partner-Portal)
          ↓
Admin sieht neue Rechnungen in Rechnungs-Inbox
          ↓
Zuordnung: Projekt + Angebotsposition(en) auswählen, Betrag eingeben
          ↓
Soll/Ist-Vergleich automatisch berechnet
          ↓
Status: pending → verified (oder disputed bei Abweichung)
```

### Kostenzuordnung pro Angebotsposition
Eine Position kann mehrere Kostenarten enthalten:

**Beispiel: Position "AC-Montage" — kalkuliert 1.300 EUR**

| Kostenart | Beschreibung | Betrag |
|---|---|---|
| Sub-Rechnung | Elektriker Müller — Arbeit | 850 EUR |
| Sub-Rechnung | Elektriker Müller — Material | 120 EUR |
| Material (eigen) | 3x Wechselrichter aus Lager | 780 EUR |
| Material (eigen) | 50m AC-Kabel aus Lager | 95 EUR |
| **Ist-Kosten gesamt** | | **1.845 EUR** |
| **Soll (kalkuliert)** | | **1.300 EUR** |
| **Differenz** | | **-545 EUR** |

### Quellen für Soll-Kosten (Priorität)
1. **Angebotsposition** (Hauptquelle) — kalkulierter Betrag aus Angebot
2. **Inquiry-Response** (optional) — falls vorhanden, als Referenzwert
3. **Ohne Referenz** — nur Ist-Kosten erfasst

### Abweichungs-Handling
- Rechnung > Angebot: Warnung mit Differenz
- Rechnung < Angebot: Positiv hervorgehoben
- Bei `disputed`: Notizfeld, bleibt offen bis resolved

## Nachkalkulations-Abschluss

### Status-Flow
```
open → in_review → closed
```

### Abschluss-Prüfung
System zeigt offene Posten:
- Positionen ohne zugeordnete Kosten
- Nicht zurückgebuchtes Material
- Sub-Rechnungen im Status `pending`

Nutzer kann trotzdem abschließen (mit Bestätigung). Abgeschlossene Projekte fließen in Statistiken ein.

## UI-Bereiche

### Neue Seiten/Bereiche

| Bereich | Route | Beschreibung |
|---|---|---|
| Nachkalkulation | Projekt-Detail Tab | Soll/Ist pro Position, Kostenerfassung, Abschluss |
| Materialfluss | Projekt-Detail Tab + Artikelübersicht | Ausgabe/Rückgabe, Verbrauch, Lagerwarnung |
| Rechnungs-Inbox | `/rechnungen` | Unzugeordnete Partner-Rechnungen zuordnen |
| Gemeinkosten-Settings | `/einstellungen` | Jahresumsatz + Gemeinkosten pflegen |
| Statistiken | `/statistiken` | KPIs, Diagramme, Drill-Down |
| Dashboard-Widgets | `/dashboard` | Gewinn, Marge, offene Nachkalkulationen, Lagerwarnung |

### Dashboard-Widgets
- Gewinn aktueller Monat (mit Trend vs. Vormonat)
- Durchschnittliche Marge
- Offene Nachkalkulationen (Anzahl)
- Lager-Warnungen (Artikel unter Mindestbestand)

### Statistik-Seite
**Filter:** Woche / Monat / Quartal / Jahr / Custom

**Diagramme (Recharts):**
- Gewinn-Trend (Linie, über Zeit)
- Marge pro Projekt (Balken, sortiert)
- Kostenverteilung (Donut: Material vs. Sub vs. Gemeinkosten)
- Soll/Ist-Vergleich (gruppierte Balken)

**Tabellen:**
- Top/Flop Projekte nach Marge
- Profitabelste Gewerke
- Sub-Performance (Angebot vs. Rechnung Abweichung)
- Materialverbrauch pro Projekt

## KPIs

### Profitabilität
1. Gewinn pro Projekt (Angebotssumme - Gesamtkosten)
2. Marge in % pro Projekt
3. Gewinn pro Woche / Monat / Jahr
4. Durchschnittliche Marge über alle Projekte

### Kostenanalyse
5. Soll vs. Ist Vergleich (Angebot vs. reale Kosten)
6. Kostenverteilung (Material vs. Sub vs. Gemeinkosten)
7. Profitabelste/unprofitabelste Gewerke

### Material/Lager
8. Materialverbrauch pro Projekt
9. Lagerbestand mit Nachbestellwarnung

### Subs
10. Profitabelste Subunternehmer
11. Abweichung Sub-Angebot vs. Sub-Rechnung
