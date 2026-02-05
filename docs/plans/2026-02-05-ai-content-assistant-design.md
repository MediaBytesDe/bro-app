# AI Content Assistant - Design Dokument

**Datum:** 2026-02-05
**Feature:** Wiederverwendbare AI-Assistent-Komponente für Content-Generierung

## Übersicht

Eine wiederverwendbare Komponente, die überall in der App platziert werden kann, um AI-generierten Content zu erstellen. Mit zentraler Verwaltung von Domain-spezifischen Prompts.

## Architektur

### Komponenten

1. **AIAssistantButton** - Trigger-Button neben Eingabefeldern
2. **AIAssistantModal** - Zentrales Popup (1x global im Layout)
3. **useAIAssistant** - Custom Hook für State-Management
4. **Admin-Seite** - Verwaltung der Content-Prompts

### Verwendung

```typescript
<AIAssistantButton
  currentValue={product.description}
  domain="product_description"
  context={{
    productName: product.name,
    category: product.category,
    manufacturer: product.manufacturer
  }}
  onGenerated={(text) => updateField("description", text)}
/>
```

## User Flow

1. **Button Click** → Modal öffnet sich
2. **Domain-Auswahl** → Dropdown zeigt verfügbare Prompts
3. **Aktueller Inhalt** → Wird angezeigt (wenn vorhanden)
4. **Zusätzliche Anweisungen** → User kann Anweisungen hinzufügen:
   - "Mache es kürzer"
   - "Füge technische Details hinzu"
   - "Schreibe es für Endkunden"
5. **Generieren** → Loading-State während AI arbeitet
6. **Ergebnis-Ansicht:**
   - Generierter Text in Textarea (editierbar)
   - Buttons: "Neu generieren", "Übernehmen", "Abbrechen"
7. **Übernehmen** → Text wird in Original-Feld eingefügt, Modal schließt

## Datenbank-Schema

### Tabelle: ai_content_prompts

```sql
CREATE TABLE ai_content_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain VARCHAR(100) NOT NULL,              -- z.B. "product_description"
  name VARCHAR(200) NOT NULL,                -- z.B. "Produktbeschreibung (Marketing)"
  description TEXT,                          -- Admin-Notiz
  system_prompt TEXT NOT NULL,               -- System-Rolle für AI
  user_prompt_template TEXT NOT NULL,        -- Template mit Platzhaltern
  placeholder_fields JSONB,                  -- Welche Felder erwartet werden
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_prompts_domain ON ai_content_prompts(domain, is_active);
```

### RLS Policies

```sql
-- Alle können aktive Prompts sehen
CREATE POLICY "Everyone can view active prompts"
  ON ai_content_prompts FOR SELECT
  USING (is_active = true OR EXISTS (
    SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin'
  ));

-- Nur Admins können bearbeiten
CREATE POLICY "Only admins can modify prompts"
  ON ai_content_prompts FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE auth_id = auth.uid() AND role = 'admin'
  ));
```

## API-Struktur

### Content generieren

**Endpoint:** `/api/openclaw/generate-content`

**Request:**
```json
{
  "promptId": "uuid",
  "currentValue": "aktueller Feldinhalt",
  "context": {
    "productName": "Solarmodul 400W",
    "category": "Module",
    "manufacturer": "Trina"
  },
  "userInstructions": "Mache es kürzer und technischer"
}
```

**Response:**
```json
{
  "success": true,
  "generated": "Generierter Text...",
  "tokensUsed": 150
}
```

### Prompts laden

**Endpoint:** `/api/ai-content-prompts?domain=product_description`

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "Produktbeschreibung (Marketing)",
    "domain": "product_description",
    "systemPrompt": "...",
    "userPromptTemplate": "...",
    "placeholderFields": ["productName", "category"]
  }
]
```

## Prompt-Template System

### System Prompt Beispiel

```
Du bist ein Marketing-Experte für Solar-Produkte.
Schreibe verkaufsfördernde, präzise Produktbeschreibungen.
Halte dich an diese Regeln:
- Maximal 200 Wörter
- Fokus auf Nutzen, nicht nur Features
- Technische Daten einbeziehen
- Verkaufsfördernde Sprache
```

### User Prompt Template

```
Erstelle eine Produktbeschreibung für:

Name: {{productName}}
Kategorie: {{category}}
Hersteller: {{manufacturer}}

Aktueller Text: {{currentValue}}

Zusätzliche Anweisungen: {{userInstructions}}
```

## Admin-Seite

**Route:** `/openclaw/content-prompts`

### Features

- Liste aller Prompts gruppiert nach Domain
- CRUD-Funktionen: Erstellen, Bearbeiten, Löschen, Sortieren
- Test-Funktion: Prompt direkt testen mit Sample-Daten
- Beispiel-Prompts vorinstalliert

### Standard-Prompts

1. **Produktbeschreibung (Marketing)** - Verkaufsfördernde Texte
2. **Produktbeschreibung (Technisch)** - Technische Details
3. **E-Mail an Kunde** - Professionelle Kundenkommunikation
4. **Projekt-Zusammenfassung** - Projekt-Beschreibungen

## OpenClaw Agent

### Neuer Agent: content:main

```typescript
export type OpenClawAgent =
  | "main"
  | "einkauf"
  | "kundenservice"
  | "content:main";  // NEU
```

Dieser Agent ist spezialisiert auf Content-Generierung und verwendet die konfigurierten Prompts aus der Datenbank.

## Error Handling

- **Network-Fehler** → Retry mit Exponential Backoff
- **AI-Fehler** → Benutzerfreundliche Meldung anzeigen
- **Timeout** → Nach 30s abbrechen
- **Validierung** → Max 5000 Zeichen Output
- **Rate Limiting** → Max 10 Requests pro Minute pro User

## UI/UX Details

### Modal-Design

- Fullscreen auf Mobile (<768px)
- Centered Dialog auf Desktop (max-w-2xl)
- Dunkles Theme passend zur App
- Live-Preview des generierten Texts
- Character Count anzeigen
- Loading-States mit Animation

### Button-Design

- Kleines Sparkles-Icon (✨)
- Position: Rechts neben Label oder in Toolbar
- Tooltip: "AI-Assistent"
- Disabled wenn kein Prompt verfügbar

## Testing

### Unit Tests

- Prompt-Template-Engine
- Placeholder-Replacement
- Error Handling

### Integration Tests

- API-Endpoints
- Database Queries
- RLS Policies

### E2E Tests

- Kompletter User-Flow
- Modal öffnen/schließen
- Content generieren und übernehmen

## Deployment

1. **Migration** automatisch bei Deployment
2. **Seed-Daten** für Standard-Prompts
3. **Navigation** in app-shell.tsx erweitern

## Performance

- Prompts werden gecached (React Query)
- Modal lazy-loaded
- API-Calls debounced
- Optimistic Updates für bessere UX
