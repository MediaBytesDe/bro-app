# Portal-Spezifikation v1.0

*Erstellt: 04.02.2026*

---

## Übersicht

Drei Benutzergruppen mit jeweils eigener Ansicht:

| Gruppe | Route | Beschreibung |
|--------|-------|--------------|
| **Intern** | `/app/*` | André, Simon - Vollzugriff |
| **Kunde** | `/portal/*` | Endkunden - Projekt verfolgen |
| **Partner** | `/partner/*` | Subunternehmer - Aufträge bearbeiten |

---

## 👤 KUNDENPORTAL `/portal`

### Seiten

| Route | Beschreibung | Status |
|-------|--------------|--------|
| `/portal` | Dashboard mit Übersicht | ✅ Existiert |
| `/portal/projekte` | Projektliste | ✅ Existiert |
| `/portal/projekte/[slug]` | Projektdetails + Status-Tracker | 🔄 Erweitern |
| `/portal/termine` | Termine sehen + selbst buchen | ❌ Neu |
| `/portal/dokumente` | Upload + Download | ❌ Neu |
| `/portal/nachrichten` | Chat mit BROjekt | ❌ Neu |
| `/portal/zahlungen` | Zahlungsstatus | ❌ Neu |
| `/portal/angebote` | Angebotsliste + PDF | ✅ Existiert |

### Features

#### Status-Tracker
Visueller Projektfortschritt:
```
[✓] Angebot → [✓] Auftrag → [●] Material → [ ] Montage → [ ] Abnahme → [ ] Fertig
```

#### Termine buchen
- Kunde sieht verfügbare Slots (von BROjekt freigegeben)
- Kann Besichtigung/Beratung selbst buchen
- Sieht alle eigenen Termine (auch Montage etc.)
- Kalender-Sync mit BROjekt (MS 365)

#### Dokumente
- **Upload:** Unterschriebener Vertrag, Fotos Zählerschrank, etc.
- **Download:** Angebot, Planung, Datenblätter, Rechnung

#### Chat
- Direkte Kommunikation mit BROjekt
- Anhänge möglich
- Push-Benachrichtigung bei neuer Nachricht

#### Zahlungen
- Übersicht: 50% Anzahlung, 50% Schlussrechnung
- Status: Offen / Bezahlt / Überfällig
- Verknüpfung mit Lexware-Rechnungen

---

## 🔧 PARTNER-PORTAL `/partner`

### Seiten

| Route | Beschreibung | Berechtigung |
|-------|--------------|--------------|
| `/partner` | Dashboard | Alle |
| `/partner/auftraege` | Auftragspool + Meine | Alle |
| `/partner/auftraege/[id]` | Auftragsdetails | Zugewiesene |
| `/partner/auftraege/[id]/rapport` | Fertigmeldung | Zugewiesene |
| `/partner/auftraege/[id]/chat` | Projekt-Chat | Zugewiesene |
| `/partner/kalender` | Team-Kalender | Alle |
| `/partner/rechnungen` | Rechnungen hochladen | Alle |
| `/partner/team` | Mitarbeiter verwalten | Nur Admin |
| `/partner/team/einladen` | Mitarbeiter einladen | Nur Admin |
| `/partner/einstellungen` | Firmenprofil | Nur Admin |

### Rollen

| Rolle | Beschreibung |
|-------|--------------|
| **Admin** | GF / Vorarbeiter - Sieht alles, kann Team verwalten |
| **Worker** | Mitarbeiter - Sieht nur zugewiesene Aufträge |

### Einladungs-Flow

```
1. André legt Partner-Firma an (in /app)
2. Partner-Admin bekommt E-Mail mit Einladungslink
3. Admin registriert sich, wird automatisch Admin der Firma
4. Admin kann eigene Mitarbeiter einladen
5. Mitarbeiter bekommen E-Mail, registrieren sich
6. Admin kann Mitarbeiter aktivieren/deaktivieren
```

### Auftrags-Flow

```
1. BROjekt erstellt Auftrag (Gewerk, Termin, Details)
2. Auftrag erscheint im Pool für passende Partner
3. Partner-Admin nimmt an oder lehnt ab
4. Bei Annahme: Admin weist Mitarbeiter zu (oder sich selbst)
5. Mitarbeiter sieht Auftrag in seiner Liste
6. Mitarbeiter führt aus, schreibt Rapport
7. Kunde unterschreibt auf Handy des Mitarbeiters
8. Auftrag = erledigt
```

### Auftragsdetails

Was der Partner sieht:
- **Kunde:** Name, Adresse, Telefon (für Terminabsprache)
- **Anlage:** kWp, Module, Wechselrichter, Speicher, Dachtyp
- **Dokumente:** Dachbelegung, Planung, Schaltplan
- **Team:** Andere Subs im Projekt + deren Termine
- **Chat:** Kommunikation mit anderen Subs + BROjekt

Was der Partner NICHT sieht:
- Kundenpreis / Angebotssumme
- Interne Notizen von BROjekt

### Rapport (Fertigmeldung)

```
┌─────────────────────────────────┐
│ Rapport für Auftrag #123        │
├─────────────────────────────────┤
│ Beschreibung:                   │
│ ┌─────────────────────────────┐ │
│ │ Montage abgeschlossen.      │ │
│ │ 12 Module installiert.      │ │
│ │ WR in Betrieb genommen.     │ │
│ └─────────────────────────────┘ │
│                                 │
│ Fotos: [+] [📷] [📷] [📷]       │
│                                 │
│ ┌─────────────────────────────┐ │
│ │  Kundenunterschrift holen   │ │
│ └─────────────────────────────┘ │
│                                 │
│ [Rapport abschließen]           │
└─────────────────────────────────┘
```

### Unterschrift

1. Button "Kundenunterschrift holen"
2. Vollbild-Canvas öffnet sich (Landscape empfohlen)
3. Kunde unterschreibt mit Finger
4. Name des Kunden eingeben
5. Speichern → Canvas wird als PNG gespeichert
6. Zurück zum Rapport

### Partner-Rechnungen

- Partner lädt PDF seiner Rechnung hoch
- Optional: Projekt zuordnen
- Status: Hochgeladen → Geprüft → Bezahlt
- BROjekt sieht alle Rechnungen in `/app`

---

## 🔔 BENACHRICHTIGUNGEN

### Events

| Event | Empfänger | Priorität |
|-------|-----------|-----------|
| Neuer Auftrag im Pool | Passende Partner (Admin) | Hoch |
| Auftrag angenommen | BROjekt | Normal |
| Auftrag zugewiesen | Partner-Mitarbeiter | Hoch |
| Neue Chat-Nachricht | Projekt-Teilnehmer | Normal |
| Termin geändert | Betroffene | Hoch |
| Rapport eingereicht | BROjekt | Normal |
| Zahlung erhalten | Kunde | Normal |

### Kanäle (vorbereitet)

- **Push** (später: PWA)
- **E-Mail** (Resend/SMTP)
- **WhatsApp** (wacli / Business API)
- **n8n Webhook** (für custom Flows)

### Implementation

```typescript
// Notification erstellen
await createNotification({
  recipientType: 'partner_user',
  recipientId: userId,
  type: 'new_job',
  title: 'Neuer Auftrag verfügbar',
  body: 'DC-Montage in Esens, 10.4 kWp',
  data: { jobId: '...' },
  channels: ['push', 'whatsapp']
});

// n8n/Bro holt pending notifications
const pending = await supabase
  .from('notifications')
  .select('*')
  .eq('delivered_via', '[]')
  .order('created_at');
```

---

## 📅 KALENDER-SYNC

### Microsoft 365 Integration

- BROjekt-Kalender: `a.freese@brojekt.gmbh`
- Termine werden bidirektional synchronisiert
- Event-ID wird in `appointments.calendar_event_id` gespeichert

### Verfügbare Slots

```typescript
// BROjekt gibt Slots frei
available_slots: {
  date: '2026-02-10',
  time_start: '09:00',
  time_end: '12:00',
  slot_type: 'besichtigung',
  max_bookings: 1
}

// Kunde bucht
appointments: {
  date: '2026-02-10',
  time_start: '09:00',
  type: 'besichtigung',
  booked_by: 'customer'
}
```

---

## 📊 DATENBANK-SCHEMA

### Neue Tabellen

```sql
-- Partner-Firma
partners (
  id, company_name, trade, email, phone, 
  address, logo_url, active, created_at
)

-- Partner-Benutzer
partner_users (
  id, partner_id, auth_user_id, display_name,
  email, phone, role, active, invited_at, joined_at
)

-- Aufträge
partner_jobs (
  id, project_id, title, description, trade,
  scheduled_date, scheduled_time, estimated_hours,
  status, accepted_by_partner_id, accepted_at,
  assigned_to_user_id, completed_at
)

-- Rapport
job_reports (
  id, job_id, partner_user_id, report_text,
  photos, customer_signature_url, customer_name,
  signed_at, created_at
)

-- Partner-Rechnungen
partner_invoices (
  id, partner_id, project_id, invoice_number,
  file_url, amount, notes, status, uploaded_at
)

-- Termine
appointments (
  id, project_id, customer_id, title, type,
  date, time_start, time_end, location,
  booked_by, partner_job_id, notes, status,
  calendar_event_id, created_at
)

-- Verfügbare Slots
available_slots (
  id, date, time_start, time_end, slot_type,
  max_bookings, current_bookings
)

-- Zahlungen
payments (
  id, project_id, customer_id, description,
  amount, due_date, status, paid_at,
  lexware_invoice_id
)

-- Chat
messages (
  id, project_id, sender_type, sender_id,
  sender_name, text, attachments,
  visible_to_customer, visible_to_partners,
  read_by, created_at
)

-- Benachrichtigungen
notifications (
  id, recipient_type, recipient_id, type,
  title, body, data, channels, delivered_via,
  read_at, created_at
)
```

### Erweiterungen bestehender Tabellen

```sql
-- documents
ADD uploaded_by TEXT
ADD visible_to_customer BOOLEAN
ADD visible_to_partners BOOLEAN

-- profiles (für Rollen)
ADD role TEXT -- 'admin', 'user', 'customer', 'partner'
```

---

## 🚀 IMPLEMENTATION REIHENFOLGE

### Phase 1: Datenbank
1. [ ] Neue Tabellen erstellen
2. [ ] RLS Policies definieren
3. [ ] Bestehende Tabellen erweitern

### Phase 2: Partner-Portal (Basis)
1. [ ] Layout + Navigation
2. [ ] Partner-Auth (Login, Einladung)
3. [ ] Dashboard
4. [ ] Auftragsliste + Details
5. [ ] Auftrag annehmen/ablehnen

### Phase 3: Partner-Portal (Features)
1. [ ] Rapport mit Fotos
2. [ ] Unterschrift-Canvas
3. [ ] Team-Verwaltung
4. [ ] Rechnungen hochladen
5. [ ] Projekt-Chat

### Phase 4: Kundenportal (Erweiterung)
1. [ ] Status-Tracker
2. [ ] Termine buchen
3. [ ] Dokumente Upload
4. [ ] Chat
5. [ ] Zahlungsstatus

### Phase 5: Benachrichtigungen
1. [ ] Notification-System
2. [ ] E-Mail Integration
3. [ ] WhatsApp Integration
4. [ ] n8n Webhooks

### Phase 6: Kalender
1. [ ] Verfügbare Slots
2. [ ] MS 365 Sync
3. [ ] Partner-Kalender

---

## 📝 NOTIZEN

- Partner sehen KEINE Preise (weder eigene Vergütung noch Kundenpreis)
- Partner können eigene Rechnungen hochladen
- Unterschrift passiert auf dem Handy des Partners
- Pool-System: Mehrere Partner können sich auf Aufträge bewerben
- Bei mehreren Subs im Projekt: Gegenseitige Termine sichtbar + Chat
