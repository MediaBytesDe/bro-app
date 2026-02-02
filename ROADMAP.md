# BROjekt App - Roadmap & Architektur

## 🎯 Vision
Zentrales System der BROjekt GmbH für Kunden-, Lead-, Projekt- und Subunternehmerverwaltung mit Lexware-Integration.

---

## 📦 Module-Übersicht

### 1. 👥 Kundenmanagement
- Kundenstammdaten (Name, Adresse, Kontakt, Steuernummer)
- **Lexware Sync** (bidirektional)
- Kundenhistorie (Projekte, Angebote, Rechnungen)
- Kundenportal-Zugang verwalten

### 2. 🎯 Leadmanagement
- Lead-Erfassung (Quelle, Interesse, Kontaktdaten)
- Lead-Status-Pipeline (Neu → Kontaktiert → Qualifiziert → Angebot → Gewonnen/Verloren)
- Lead → Kunde Konvertierung
- Automatische E-Mail-Generierung (OpenClaw Skill)

### 3. 📄 Angebotserstellung
- **Lexware API** für Angebote/Rechnungen
- Angebotsvorlagen (Sofort.Solar, Gutachten, etc.)
- PDF-Export
- Status-Tracking (Erstellt → Gesendet → Angenommen → Abgelehnt)

### 4. 📁 Projektmanagement
- Projektübersicht (Kanban, Liste, Kalender)
- Projekt-Phasen & Meilensteine
- **Subunternehmerverwaltung**
  - Eingeschränkter Zugriff auf zugeteilte Projekte
  - Eigenes Login für Subunternehmer
- **Dokumentenverwaltung**
  - OneDrive Integration
  - Automatische Ordnerstruktur pro Projekt
  - Bilder, PDFs, Videos
- **Terminverwaltung**
  - Alle Projektbeteiligten sehen Termine
  - Subunternehmer können eigene Termine eintragen
- **Rapport-System**
  - Tägliche/wöchentliche Baustellendokumentation
  - Fotos mit Beschreibung
  - Automatische Abschlussdokumentation

### 5. 📝 Formular-System
- Dynamische Formulare erstellen
- **Aufnahmebogen** (Vor-Ort-Besichtigung)
- **Datenschutzerklärung** mit Unterschrift
- **Abnahmeprotokoll**
- Digitale Unterschrift (Touch/Stylus)
- PDF-Export & E-Mail-Versand

### 6. 🤖 OpenClaw Integration
- Heartbeat-Verwaltung (HEARTBEAT.md Editor)
- Cronjob-Management (UI für cron tool)
- Skill-Verwaltung (Skills aus DB ausführen)
- Log-Viewer (Echtzeit-Logs)

### 7. 🔐 Kundenportal
- Kunden-Login (eigene Auth-Rolle)
- Projektübersicht (nur eigene Projekte)
- Dokumente einsehen
- Termine sehen
- Status-Updates

---

## 🔄 Workflow: Sofort.Solar Projekt

```
┌─────────────┐
│   1. LEAD   │ Anfrage über Website/Telefon
└──────┬──────┘
       ▼
┌─────────────┐
│  2. TERMIN  │ VOB-Termin vereinbaren
└──────┬──────┘
       ▼
┌─────────────┐
│   3. VOB    │ Vor-Ort-Besichtigung
│             │ • Aufnahmebogen ausfüllen
│             │ • Datenschutz unterschreiben
│             │ • Fotos (Dach, Zähler, Umgebung)
│             │ • Drohnenflug
└──────┬──────┘
       ▼
┌─────────────┐
│ 4. PLANUNG  │ • 3D-Modell erstellen
│             │ • PV'Sol Simulation
│             │ • Wirtschaftlichkeitsberechnung
└──────┬──────┘
       ▼
┌─────────────┐
│ 5. ANGEBOT  │ • Angebot in Lexware erstellen
│             │ • PDF an Kunde senden
│             │ • Im Projekt speichern
└──────┬──────┘
       ▼
┌─────────────┐
│ 6. AUFTRAG  │ Bei Annahme:
│             │ • Lead → Kunde konvertieren
│             │ • Subunternehmer zuweisen
│             │ • Benachrichtigungen (Email/WhatsApp)
└──────┬──────┘
       ▼
┌─────────────┐
│ 7. MONTAGE  │ • Subunternehmer machen Termine
│             │ • Rapporte schreiben
│             │ • Fotos dokumentieren
│             │ • Anmeldung beim Netzbetreiber
└──────┬──────┘
       ▼
┌─────────────┐
│ 8. ABSCHLUSS│ • Abschlussdokumentation generieren
│             │ • Rechnung in Lexware
│             │ • Übergabe an Kunde
└─────────────┘
```

---

## 🗄️ Datenbank-Erweiterungen

### Neue Tabellen

```sql
-- Kunden (aus Leads konvertiert)
customers (
  id, lead_id, lexware_id,
  company, name, email, phone, address,
  tax_number, customer_since, portal_access,
  created_at, updated_at
)

-- Angebote
quotes (
  id, customer_id, project_id, lexware_quote_id,
  title, description, amount, tax, total,
  status (draft/sent/accepted/rejected),
  valid_until, sent_at, accepted_at,
  pdf_url, created_at, updated_at
)

-- Subunternehmer
subcontractors (
  id, company, name, email, phone,
  trade (elektriker/dachdecker/gerüstbau/...),
  hourly_rate, notes, active,
  portal_access, created_at
)

-- Projekt-Subunternehmer Zuordnung
project_subcontractors (
  id, project_id, subcontractor_id,
  role, access_level, assigned_at
)

-- Termine
appointments (
  id, project_id, customer_id,
  title, description, type (vob/montage/abnahme/...),
  start_time, end_time, location,
  attendees (jsonb), created_by, created_at
)

-- Rapporte (Baustellendokumentation)
reports (
  id, project_id, subcontractor_id,
  date, description, hours_worked,
  weather, issues, photos (jsonb),
  created_at
)

-- Dokumente
documents (
  id, project_id, customer_id,
  type (aufnahmebogen/datenschutz/angebot/rechnung/foto/...),
  title, file_url, onedrive_id,
  signed, signature_url, created_at
)

-- Formulare (Templates)
form_templates (
  id, name, slug, description,
  fields (jsonb), requires_signature,
  created_at, updated_at
)

-- Ausgefüllte Formulare
form_submissions (
  id, template_id, project_id, customer_id,
  data (jsonb), signature_url, pdf_url,
  submitted_at, created_by
)
```

---

## 🔌 Externe Integrationen

### Lexware API
- Kunden anlegen/synchronisieren
- Angebote erstellen
- Rechnungen erstellen
- Zahlungsstatus abfragen

### OneDrive / Microsoft Graph API
- Projektordner automatisch erstellen
- Dateien hochladen
- Ordnerstruktur verwalten
- Sharing-Links generieren

### WhatsApp Business API (optional)
- Benachrichtigungen an Subunternehmer
- Terminbestätigungen

### E-Mail (SMTP)
- Angebote versenden
- Terminbestätigungen
- Formulare als PDF

---

## 👥 Benutzerrollen

| Rolle | Zugriff |
|-------|---------|
| **Admin** | Alles |
| **Mitarbeiter** | Projekte, Kunden, Leads, Angebote |
| **Subunternehmer** | Nur zugewiesene Projekte, Rapporte, Termine |
| **Kunde** | Nur eigene Projekte (read-only), Dokumente, Termine |

---

## 🚀 Entwicklungs-Phasen

### Phase 1: Basis (Woche 1-2)
- [ ] Auth-System (Supabase Auth)
- [ ] Benutzer & Rollen
- [ ] Dashboard-Layout
- [ ] Projektverwaltung (CRUD)

### Phase 2: Kunden & Leads (Woche 3-4)
- [ ] Lead-Management (erweitert)
- [ ] Kundenverwaltung
- [ ] Lead → Kunde Konvertierung
- [ ] Lexware API Integration (Basis)

### Phase 3: Dokumente & Formulare (Woche 5-6)
- [ ] OneDrive Integration
- [ ] Formular-Builder
- [ ] Digitale Unterschrift
- [ ] PDF-Generierung

### Phase 4: Subunternehmer & Termine (Woche 7-8)
- [ ] Subunternehmerverwaltung
- [ ] Terminkalender
- [ ] Rapport-System
- [ ] Benachrichtigungen

### Phase 5: Angebote & Abschluss (Woche 9-10)
- [ ] Angebotserstellung (Lexware)
- [ ] Abschlussdokumentation
- [ ] Kundenportal

### Phase 6: OpenClaw & Polish (Woche 11-12)
- [ ] OpenClaw Integration (Heartbeat, Skills, Logs)
- [ ] Mobile Optimierung
- [ ] Testing & Bugfixes

---

## 📂 Projektstruktur

```
bro-app-next/
├── src/
│   ├── app/
│   │   ├── (app)/           # Authenticated routes
│   │   │   ├── dashboard/
│   │   │   ├── projects/
│   │   │   ├── customers/
│   │   │   ├── leads/
│   │   │   ├── quotes/
│   │   │   ├── subcontractors/
│   │   │   ├── calendar/
│   │   │   ├── documents/
│   │   │   ├── forms/
│   │   │   ├── settings/
│   │   │   └── openclaw/
│   │   ├── (portal)/        # Customer portal
│   │   │   └── portal/
│   │   ├── (subcontractor)/ # Subcontractor portal
│   │   │   └── sub/
│   │   └── auth/
│   ├── components/
│   │   ├── ui/              # shadcn/ui
│   │   ├── forms/           # Form components
│   │   ├── projects/
│   │   ├── customers/
│   │   └── ...
│   ├── lib/
│   │   ├── supabase/
│   │   ├── lexware/
│   │   ├── onedrive/
│   │   └── pdf/
│   └── types/
└── supabase/
    ├── migrations/
    └── functions/
```

---

## ✅ Nächste Schritte

1. **Schema-Migration** - Neue Tabellen anlegen
2. **Auth-System** - Supabase Auth mit Rollen
3. **API-Routes** - Next.js API für Integrationen
4. **UI-Komponenten** - Dashboard, Formulare, Listen

---

*Erstellt: 2026-02-02*
*Letzte Aktualisierung: 2026-02-02*
