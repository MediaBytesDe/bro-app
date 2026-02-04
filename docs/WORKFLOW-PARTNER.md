# Partner/Subunternehmer Workflow

## Gesamtablauf

```
Lead → Projekt → Vor-Ort-Termin → Angebot → Ablehnung/Annahme
                                                    ↓
                                              Bei Annahme:
                                                    ↓
                                    Projekt bekommt Tasks (Gewerke)
                                                    ↓
                                    Tasks erscheinen im Pool für Subis
                                                    ↓
                                    Subi nimmt Auftrag an (verbindlich)
                                                    ↓
                                    Subi sieht Kundendaten
                                                    ↓
                                    Subi macht Termin mit Kunde
                                                    ↓
                                    Durchführung + Rapport
```

## Auftrags-Struktur

### Tasks mit Subtasks
```
Projekt: PV Müller (Esens)
├── Task: DC-Montage [Gewerk: Dachdecker/Montage]
│   ├── Subtask: Gerüst aufbauen
│   ├── Subtask: Module montieren
│   └── Subtask: Verkabelung DC
├── Task: AC-Montage [Gewerk: Elektriker]
│   ├── Subtask: Wechselrichter montieren
│   ├── Subtask: Speicher anschließen
│   ├── Subtask: Zählerschrank verdrahten
│   └── Subtask: Netzanmeldung
└── Task: Gerüstbau [Gewerk: Gerüstbau]
```

## Subunternehmer-Kategorien (Gewerke)

| Gewerk | Beschreibung | Typische Tasks |
|--------|--------------|----------------|
| `elektriker` | Elektrofachbetrieb | AC-Montage, Speicher, Netzanmeldung |
| `dachdecker` | Dachdecker/Zimmerei | DC-Montage, Unterkonstruktion |
| `montage` | PV-Montagebetrieb | DC-Montage, Modulverlegung |
| `geruestbau` | Gerüstbauer | Gerüststellung |
| `tiefbau` | Tiefbau | Erdarbeiten, Kabelgraben |

## Pool-Ansicht (vor Annahme)

**Sichtbar:**
- Projektname (ohne Nachname): "PV M. (Esens)"
- PLZ + Ort
- Anlagengröße (kWp)
- Modulanzahl
- Dachtyp
- Geschätzter Zeitaufwand
- Wunschtermin (falls vorhanden)

**NICHT sichtbar:**
- Vollständiger Kundenname
- Adresse
- Telefon
- E-Mail
- Preise/Kosten

## Nach Annahme (verbindlich)

**Zusätzlich sichtbar:**
- Vollständiger Kundenname
- Komplette Adresse
- Telefon + E-Mail
- Projektdokumente (Planung, Dachbelegung)
- Andere Gewerke im Projekt + deren Termine

**Subi kann:**
- Eigenen Termin mit Kunde vereinbaren
- Termin im System eintragen
- Mit Kunde/BROjekt chatten
- Subtasks abhaken
- Rapport schreiben

## DB-Änderungen benötigt

### 1. Partner-Gewerke
```sql
-- Partner können mehrere Gewerke haben
ALTER TABLE partners ADD COLUMN trades text[] DEFAULT '{}';
-- z.B. ['elektriker', 'ac_montage']
```

### 2. Job-Gewerke
```sql
-- Jobs haben ein Gewerk für Filterung
ALTER TABLE partner_jobs ADD COLUMN trade text;
-- z.B. 'elektriker'
```

### 3. Subtasks
```sql
CREATE TABLE partner_job_subtasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES partner_jobs(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  sort_order int DEFAULT 0,
  completed boolean DEFAULT false,
  completed_at timestamptz,
  completed_by uuid REFERENCES partner_users(id),
  created_at timestamptz DEFAULT now()
);
```

### 4. Selbst-Terminierung
```sql
-- Partner kann eigenen Termin setzen
ALTER TABLE partner_jobs ADD COLUMN partner_scheduled_date date;
ALTER TABLE partner_jobs ADD COLUMN partner_scheduled_time time;
ALTER TABLE partner_jobs ADD COLUMN partner_scheduled_notes text;
```

## UI-Änderungen

### Pool-Liste
- Zeigt nur anonymisierte Daten
- Filter nach Gewerk (automatisch basierend auf Partner-Gewerken)
- "Annehmen" Button mit Bestätigung ("Verbindlich!")

### Auftragsdetail (nach Annahme)
- Volle Kundendaten
- Subtask-Checkliste
- Termin-Eingabe (Datum, Uhrzeit, Notizen)
- Button "Termin mit Kunde vereinbaren" → öffnet Telefon/WhatsApp
