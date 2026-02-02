# BROjekt App - Projekt Status

**Letzte Aktualisierung:** 2026-02-02 14:16

---

## 📊 Gesamtfortschritt

```
Phase 1: Basis           [██████████] 100% ✅ Auth, Schema, Types, Navigation
Phase 2: Kunden & Leads  [██████████] 100% ✅ CRUD, Lead→Kunde, Lexware Sync
Phase 3: Dokumente       [██████████] 100% ✅ OneDrive, Upload, Signature Pad
Phase 4: Subunternehmer  [██████████] 100% ✅ CRUD, Detail, Projekt-Zuordnung, Kalender
Phase 5: Angebote        [██████████] 100% ✅ CRUD, Line Items, PDF Export, Lexware Sync
Phase 6: OpenClaw        [██████████] 100% ✅ Dashboard, Skills, Logs, Cron Jobs
```

---

## 🏃 Laufende Agents

| Agent | Task | Gestartet | Status |
|-------|------|-----------|--------|
| db-architect | Erweitertes DB-Schema | 13:48 | ✅ Done |
| integration-research | Lexware & OneDrive APIs | 13:48 | ✅ Done |
| types-generator | TypeScript Types | 14:12 | ✅ Done |
| auth-implementer | Auth System mit Rollen | 14:12 | ✅ Done (war schon fertig!)

---

## ✅ Abgeschlossen

- [x] Supabase auf Coolify aufgesetzt
- [x] Cloudflare Tunnel konfiguriert
- [x] Basis-Schema eingespielt
- [x] Daten von alter DB migriert (45 Tasks, 35 Leads, etc.)
- [x] ROADMAP.md erstellt

---

## 📋 TODO Queue

### Sofort (nach Agent-Ergebnissen)
- [ ] DB-Schema Migration ausführen
- [ ] TypeScript Types generieren
- [ ] Auth-System implementieren (Supabase Auth + Rollen)

### Phase 1: Basis
- [ ] Dashboard Layout
- [ ] Navigation & Routing
- [ ] Benutzer-Management UI
- [ ] Projekt-CRUD erweitern

### Phase 2: Kunden & Leads
- [ ] Kunden-Modul (CRUD)
- [ ] Lead → Kunde Konvertierung
- [ ] Lexware API Client
- [ ] Kunden-Sync

### Phase 3: Dokumente & Formulare
- [ ] OneDrive Integration
- [ ] Formular-Builder
- [ ] Digitale Unterschrift Component
- [ ] PDF-Generierung

### Phase 4: Subunternehmer
- [ ] Subunternehmer-Verwaltung
- [ ] Projekt-Zuordnung
- [ ] Termin-Kalender
- [ ] Rapport-System

### Phase 5: Angebote
- [ ] Angebots-Modul
- [ ] Lexware Angebots-Integration
- [ ] PDF-Export
- [ ] E-Mail-Versand

### Phase 6: Portale & OpenClaw
- [ ] Kundenportal
- [ ] Subunternehmer-Portal
- [ ] OpenClaw Dashboard
- [ ] Heartbeat/Cron UI

---

## 🚧 Blocker

*Keine aktuellen Blocker*

---

## 📝 Notizen

- Lexware: Vermutlich lexoffice API nutzen (cloud-basiert)
- OneDrive: Microsoft Graph API mit App Registration
- Auth: Supabase Auth mit custom claims für Rollen
