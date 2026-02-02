# Auth-System Dokumentation

## Übersicht

Das BROjekt Auth-System basiert auf **Supabase Auth** mit rollenbasierter Zugriffskontrolle.

## Rollen

| Rolle | Beschreibung | Zugriff |
|-------|--------------|---------|
| `admin` | Vollzugriff | Alle Bereiche, Settings, Benutzerverwaltung |
| `mitarbeiter` | Interne Mitarbeiter | Projekte, Kunden, Leads, Angebote (kein Löschen) |
| `subcontractor` | Externe Auftragnehmer | Nur zugewiesene Projekte |
| `customer` | Kunden | Nur eigene Projekte (read-only) |

## Architektur

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js App                          │
├─────────────────────────────────────────────────────────┤
│  middleware.ts                                          │
│  └── Prüft Session + Rolle vor jeder Route              │
├─────────────────────────────────────────────────────────┤
│  AuthProvider (Context)                                 │
│  └── Hält User, Profile, Session State                  │
├─────────────────────────────────────────────────────────┤
│  Hooks: useAuth, useRole, usePermissions                │
│  └── Zugriff auf Auth-State in Components               │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   Supabase                              │
├─────────────────────────────────────────────────────────┤
│  auth.users        │  Supabase Auth (E-Mail/Passwort)   │
│  public.users      │  App-Profile mit Rolle             │
└─────────────────────────────────────────────────────────┘
```

## Dateien

```
src/
├── contexts/
│   └── auth-context.tsx      # AuthProvider + useAuth
├── hooks/
│   └── use-auth.ts           # useRole, usePermissions, useRouteAccess
├── lib/supabase/
│   ├── client.ts             # Browser Supabase Client
│   ├── server.ts             # Server Supabase Client
│   └── middleware.ts         # Middleware mit Rollen-Check
├── types/
│   └── auth.ts               # Rollen, Permissions, Route-Zugriff
└── middleware.ts             # Next.js Middleware Entry
```

## Login-Flow

```
1. User öffnet /login
   │
2. Eingabe E-Mail + Passwort
   │
3. signIn() → Supabase Auth
   │
   ├── ❌ Fehler → Zeige Fehlermeldung
   │
   └── ✅ Erfolg
       │
4. Lade User-Profile aus public.users
   │
   ├── ❌ Kein Profil / Inaktiv → Logout + Fehlermeldung
   │
   └── ✅ Profil gefunden
       │
5. Redirect zu / oder redirectTo Parameter
```

## Usage

### In Components

```tsx
"use client";

import { useAuth } from "@/contexts/auth-context";
import { useRole, usePermissions } from "@/hooks/use-auth";

function MyComponent() {
  // Auth State
  const { user, profile, loading, signOut } = useAuth();
  
  // Rollen
  const { isAdmin, isMitarbeiter, hasRole } = useRole();
  
  // Berechtigungen
  const { canReadProjects, canWriteLeads } = usePermissions();
  
  if (loading) return <Spinner />;
  
  return (
    <div>
      <p>Willkommen, {profile?.display_name}!</p>
      
      {isAdmin && <AdminPanel />}
      
      {canWriteLeads() && <LeadForm />}
      
      <button onClick={signOut}>Logout</button>
    </div>
  );
}
```

### Berechtigungen prüfen

```tsx
const { canAccess, hasPermission } = usePermissions();

// Boolean check
if (canAccess("projects", "write")) {
  // User kann Projekte bearbeiten
}

// Detaillierter check (inkl. "assigned" / "own")
const perm = hasPermission("projects", "read");
// perm = true | false | "assigned" | "own"

if (perm === "assigned") {
  // Nur zugewiesene Projekte laden
}
```

### Route-Zugriff

```tsx
import { useRouteAccess } from "@/hooks/use-auth";

function Navigation() {
  const { canAccessRoute, getAllowedRoutes } = useRouteAccess();
  
  return (
    <nav>
      {canAccessRoute("/leads") && <Link href="/leads">Leads</Link>}
      {canAccessRoute("/team") && <Link href="/team">Team</Link>}
    </nav>
  );
}
```

## Protected Components

```tsx
import { useRole } from "@/hooks/use-auth";

// Nur für Admins
function AdminOnly({ children }) {
  const { isAdmin } = useRole();
  if (!isAdmin) return null;
  return <>{children}</>;
}

// Für bestimmte Rollen
function RoleGate({ roles, children }) {
  const { hasAnyRole } = useRole();
  if (!hasAnyRole(roles)) return null;
  return <>{children}</>;
}

// Usage
<AdminOnly>
  <DeleteButton />
</AdminOnly>

<RoleGate roles={["admin", "mitarbeiter"]}>
  <LeadTable />
</RoleGate>
```

## Middleware-Schutz

Die Middleware (`middleware.ts`) schützt alle Routes automatisch:

1. **Nicht eingeloggt** → Redirect zu `/login?redirectTo=...`
2. **Eingeloggt auf /login** → Redirect zu `/`
3. **Kein Profil / Inaktiv** → Logout + Redirect zu `/login?error=inactive`
4. **Keine Berechtigung** → Redirect + `?error=forbidden`

## Datenbank-Setup

### User-Profil erstellen

Wenn ein neuer Supabase Auth User erstellt wird, muss ein Profil in `public.users` angelegt werden:

```sql
INSERT INTO public.users (auth_id, username, email, role, display_name)
VALUES (
  'auth-user-uuid',
  'max.mustermann',
  'max@brojekt.de',
  'mitarbeiter',
  'Max Mustermann'
);
```

### Rollen ändern

```sql
UPDATE public.users
SET role = 'admin'
WHERE email = 'max@brojekt.de';
```

## Troubleshooting

### "Kein aktives Profil"

**Ursache:** User existiert in Supabase Auth, aber nicht in `public.users`.

**Lösung:** Profil erstellen (siehe oben).

### "Account deaktiviert"

**Ursache:** `active = false` in `public.users`.

**Lösung:** 
```sql
UPDATE public.users SET active = true WHERE email = 'user@example.com';
```

### Infinite Redirect Loop

**Ursache:** Middleware und Client-Side Auth kämpfen.

**Lösung:** Prüfe, dass `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_ANON_KEY` korrekt gesetzt sind.
