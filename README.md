# Bro Dashboard (Next.js + Supabase)

Ein vollständiges Projekt- und Lead-Management Dashboard, erstellt mit Next.js 15, Supabase und Tailwind CSS 4.

## Features

- 🔐 **Auth** - Login mit Supabase Auth
- 📊 **Dashboard** - Stats (offene Tasks, in Arbeit, erledigt, Leads) + Projekte Grid
- 👥 **Leads** - CRM mit Status-Tracking (new, contacted, qualified, proposal, negotiation, won, lost)
- 🧠 **Skills** - Workflow-Management für automatisierte Tasks
- 👤 **Team** - Benutzerverwaltung
- 📝 **Logs** - Aktivitäts-Protokoll
- 📁 **Projekte** - Kanban-Board mit Task-Management

## Tech Stack

- **Framework:** Next.js 15 (App Router, TypeScript)
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
- **Styling:** Tailwind CSS 4
- **Icons:** Lucide React

## Setup

### 1. Repository clonen

```bash
cd ~/Projekte/bro-app-next
```

### 2. Dependencies installieren

```bash
npm install
```

### 3. Supabase Projekt erstellen

1. Gehe zu [supabase.com](https://supabase.com) und erstelle ein neues Projekt
2. Kopiere die **Project URL** und den **anon key** aus den Project Settings → API

### 4. Umgebungsvariablen konfigurieren

```bash
cp .env.example .env.local
```

Bearbeite `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 5. Datenbank-Schema erstellen

Öffne den SQL Editor in Supabase und führe das Schema aus:

```bash
cat supabase/schema.sql
```

Kopiere den Inhalt und führe ihn im Supabase SQL Editor aus.

### 6. Ersten Benutzer erstellen

1. Gehe zu Authentication → Users in Supabase
2. Klicke "Add user" → "Create new user"
3. Gib E-Mail und Passwort ein
4. (Optional) Erstelle einen Eintrag in der `users` Tabelle mit der auth_id

### 7. Development Server starten

```bash
npm run dev
```

Öffne [http://localhost:3000](http://localhost:3000)

## Projektstruktur

```
bro-app-next/
├── src/
│   ├── app/
│   │   ├── (app)/              # Authentifizierte Routen
│   │   │   ├── page.tsx        # Dashboard
│   │   │   ├── leads/          # Leads-Verwaltung
│   │   │   ├── skills/         # Skills-Verwaltung
│   │   │   ├── team/           # Team-Verwaltung
│   │   │   ├── logs/           # Log-Übersicht
│   │   │   └── projects/       # Projekt-Detail
│   │   ├── login/              # Login-Seite
│   │   ├── auth/               # Auth Callbacks
│   │   ├── layout.tsx          # Root Layout
│   │   └── globals.css         # Global Styles
│   ├── components/
│   │   ├── ui/                 # UI-Komponenten (Modal, Spinner)
│   │   ├── app-shell.tsx       # App Layout mit Navigation
│   │   ├── dashboard.tsx       # Dashboard-Komponente
│   │   ├── leads-table.tsx     # Leads-Liste
│   │   ├── lead-detail.tsx     # Lead-Detailansicht
│   │   ├── project-detail.tsx  # Projekt mit Tasks
│   │   ├── skills-table.tsx    # Skills-Liste
│   │   ├── users-table.tsx     # Team-Verwaltung
│   │   └── logs-table.tsx      # Log-Übersicht
│   ├── lib/
│   │   ├── supabase/           # Supabase Client Setup
│   │   └── utils.ts            # Utility-Funktionen
│   ├── types/
│   │   └── database.ts         # TypeScript Types
│   └── middleware.ts           # Auth Middleware
├── supabase/
│   └── schema.sql              # Datenbank-Schema
├── .env.example
├── package.json
└── README.md
```

## Design

Das Dashboard verwendet einen Dark Theme mit:

- **Background:** `#0a0a0a` (primary), `#111` (cards)
- **Border:** `#1a1a1a`
- **Accent:** Orange/Red Gradient (`#ef4444` → `#f97316`)
- **Mobile-first** mit Bottom Navigation auf Mobile
- **Responsive** Kanban-Board für Tasks

## Scripts

```bash
npm run dev      # Development Server
npm run build    # Production Build
npm run start    # Production Server
npm run lint     # ESLint
```

## Deployment

### Vercel (Empfohlen)

1. Push zu GitHub
2. Importiere in Vercel
3. Füge Umgebungsvariablen hinzu
4. Deploy!

### Docker

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## Lizenz

MIT - BROjekt GmbH
