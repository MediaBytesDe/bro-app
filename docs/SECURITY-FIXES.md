# Security Fixes - Prioritized Task List

> **Status:** KRITISCH - Sofortige Maßnahmen erforderlich
> **Erstellt:** 2026-02-04
> **Alle Credentials sind als kompromittiert zu betrachten!**

---

## Phase 1: KRITISCH (Sofort)

### 1.1 Hardcoded API-Keys entfernen

**Dateien:**
- `src/app/api/lexware/quote-pdf/route.ts` (Zeile 3)
- `src/app/api/lexware/export-quote/route.ts` (Zeile 4)
- `src/app/api/lexware/import-quotes/route.ts` (Zeile 4)

**Problem:**
```typescript
// UNSICHER - API-Key im Quellcode
const LEXWARE_API_KEY = "1hgePA-GyqCIhCbxfkaB1kYlVvVj0kkTBJeJ6BR4GVZ-doqv";
```

**Fix:**
```typescript
// SICHER - Environment Variable
const LEXWARE_API_KEY = process.env.LEXWARE_API_KEY;
if (!LEXWARE_API_KEY) {
  throw new Error("LEXWARE_API_KEY environment variable is not set");
}
```

**Dann:** Key zur `.env.local` hinzufügen und in Coolify/Deployment konfigurieren.

---

### 1.2 Command Injection fixen

**Datei:** `src/app/api/convert/obj-to-glb/route.ts` (Zeile 68-72)

**Problem:**
```typescript
// UNSICHER - User-Input in Shell-Command
await execAsync(`npx obj2gltf -i "${objPath}" -o "${glbPath}" --binary`);
```

**Fix:**
```typescript
import { spawn } from "child_process";
import { randomUUID } from "crypto";

// Sichere Dateinamen generieren statt User-Input verwenden
const safeFileName = `${randomUUID()}.obj`;
const objPath = join(tempDir, safeFileName);
const glbPath = join(tempDir, `${randomUUID()}.glb`);

// spawn statt exec - keine Shell-Interpretation
await new Promise<void>((resolve, reject) => {
  const proc = spawn("npx", ["obj2gltf", "-i", objPath, "-o", glbPath, "--binary"]);
  const timeout = setTimeout(() => {
    proc.kill();
    reject(new Error("Timeout"));
  }, 120000);

  proc.on("close", (code) => {
    clearTimeout(timeout);
    code === 0 ? resolve() : reject(new Error(`Exit code ${code}`));
  });
});
```

---

### 1.3 Authentifizierung zu ungeschützten Endpoints hinzufügen

#### 1.3.1 Setup Endpoint

**Datei:** `src/app/api/setup/fix-permissions/route.ts`

**Fix:** Am Anfang der GET-Funktion hinzufügen:
```typescript
export async function GET(request: Request) {
  // Auth-Check hinzufügen
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Role-Check: Nur Admins
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("auth_id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ... rest of function
}
```

#### 1.3.2 Lexware Import Endpoint

**Datei:** `src/app/api/lexware/import-quotes/route.ts`

**Fix:** Gleichen Auth-Check am Anfang der POST-Funktion hinzufügen.

#### 1.3.3 Lexware Customers Endpoint

**Datei:** `src/app/api/lexware/customers/route.ts`

**Fix:** Auth-Check hinzufügen (nur admin/mitarbeiter).

---

### 1.4 .env.local aus Git-History entfernen

**Terminal-Befehle:**
```bash
# Backup machen
cp .env.local .env.local.backup

# Aus History entfernen
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env.local" \
  --prune-empty -- --all

# .gitignore prüfen
echo ".env.local" >> .gitignore

# Force push (ACHTUNG: Team informieren!)
git push origin --force --all
```

---

### 1.5 Credentials rotieren

Nach den Fixes müssen alle Credentials neu generiert werden:

1. **Supabase:**
   - Dashboard → Settings → API → Generate new keys
   - Anon Key UND Service Role Key erneuern

2. **Lexware:**
   - Neuen API-Key im Lexware-Portal generieren

3. **Microsoft/Azure:**
   - Azure Portal → App Registration → New client secret

4. **Deployment aktualisieren:**
   - Coolify/Vercel Environment Variables updaten

---

## Phase 2: HOCH (Diese Woche)

### 2.1 Passwort nicht in API-Response zurückgeben

**Datei:** `src/app/api/customers/[id]/create-login/route.ts` (Zeile 123-129)

**Problem:**
```typescript
return NextResponse.json({
  password: userPassword, // UNSICHER
});
```

**Fix:**
```typescript
// Option A: Passwort per E-Mail senden (bevorzugt)
await sendPasswordEmail(customer.email, userPassword);

return NextResponse.json({
  success: true,
  userId: authData.user.id,
  email: customer.email,
  message: `Login erstellt. Passwort wurde per E-Mail gesendet.`,
});

// Option B: Wenn E-Mail nicht möglich, einmaliges Token generieren
```

---

### 2.2 Kryptografisch sichere Passwort-Generierung

**Datei:** `src/app/api/customers/[id]/create-login/route.ts` (Zeile 141-148)

**Problem:**
```typescript
// UNSICHER - Math.random() ist vorhersagbar
password += chars.charAt(Math.floor(Math.random() * chars.length));
```

**Fix:**
```typescript
import { randomBytes } from "crypto";

function generatePassword(length = 16): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  const randomValues = randomBytes(length);
  let password = "";

  for (let i = 0; i < length; i++) {
    password += chars[randomValues[i] % chars.length];
  }

  return password;
}
```

---

### 2.3 IDOR Fix - Document Access

**Datei:** `src/app/api/documents/route.ts` (GET-Funktion)

**Problem:** Kein Ownership-Check - jeder authentifizierte User kann jedes Dokument abrufen.

**Fix:**
```typescript
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get("id");

  // Dokument mit Projekt-Info laden
  const { data: document } = await supabase
    .from("documents")
    .select(`
      *,
      projects!inner(id, customer_id)
    `)
    .eq("id", documentId)
    .single();

  if (!document) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Ownership prüfen
  const { data: userProfile } = await supabase
    .from("users")
    .select("role, id")
    .eq("auth_id", user.id)
    .single();

  const { data: customerProfile } = await supabase
    .from("customers")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  const isAdmin = userProfile?.role === "admin" || userProfile?.role === "mitarbeiter";
  const isOwner = customerProfile?.id === document.projects?.customer_id;

  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ document });
}
```

---

### 2.4 IDOR Fix - Customer Login Endpoints

**Dateien:**
- `src/app/api/customers/[id]/create-login/route.ts`
- `src/app/api/customers/[id]/delete-login/route.ts`

**Fix:** Role-Check hinzufügen:
```typescript
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Nur Admins/Mitarbeiter dürfen Logins verwalten
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("auth_id", user.id)
    .single();

  if (!profile || !["admin", "mitarbeiter"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ... rest of function
}
```

---

### 2.5 Next.js Update

**Problem:** 4 bekannte CVEs in Next.js 15.1.3

**Fix:**
```bash
npm update next@latest
# oder spezifisch:
npm install next@15.4.7
```

---

## Phase 3: MITTEL (Sprint)

### 3.1 Security Headers hinzufügen

**Datei:** `src/middleware.ts` erweitern oder neu erstellen:

```typescript
import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);

  // Security Headers
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains"
  );

  return response;
}
```

---

### 3.2 Console.logs entfernen

**Betroffene Dateien (28+ Stellen):**
```
src/app/api/upload/route.ts
src/app/api/lexware/*.ts
src/app/(partner)/**/*.tsx
```

**Fix:** Alle `console.log()` und `console.error()` entfernen oder durch proper Logging ersetzen:
```typescript
// Wenn Logging nötig, nur in Development:
if (process.env.NODE_ENV === "development") {
  console.log("Debug info:", data);
}
```

---

### 3.3 TypeScript/ESLint aktivieren

**Datei:** `next.config.ts`

**Ändern von:**
```typescript
typescript: { ignoreBuildErrors: true },
eslint: { ignoreDuringBuilds: true },
```

**Zu:**
```typescript
typescript: { ignoreBuildErrors: false },
eslint: { ignoreDuringBuilds: false },
```

**Dann:** Alle TypeScript-Fehler und ESLint-Warnungen beheben.

---

### 3.4 Passwort-Policy verschärfen

**Datei:** `src/app/api/partner/team/route.ts` (Zeile 69)

**Ändern von:**
```typescript
if (password.length < 6) {
```

**Zu:**
```typescript
if (password.length < 12) {
  return NextResponse.json({
    error: "Passwort muss mindestens 12 Zeichen haben"
  }, { status: 400 });
}

// Optional: Komplexitäts-Check
const hasUpperCase = /[A-Z]/.test(password);
const hasLowerCase = /[a-z]/.test(password);
const hasNumbers = /\d/.test(password);
const hasSpecial = /[!@#$%^&*]/.test(password);

if (!(hasUpperCase && hasLowerCase && hasNumbers)) {
  return NextResponse.json({
    error: "Passwort muss Groß-, Kleinbuchstaben und Zahlen enthalten"
  }, { status: 400 });
}
```

---

### 3.5 Input-Validierung mit Zod

**Installation:**
```bash
npm install zod
```

**Beispiel für API-Routes:**
```typescript
import { z } from "zod";

const createTeamMemberSchema = z.object({
  email: z.string().email("Ungültige E-Mail"),
  name: z.string().min(2, "Name zu kurz").max(100),
  password: z.string().min(12, "Passwort zu kurz"),
  role: z.enum(["admin", "mitarbeiter", "viewer"]),
});

export async function POST(request: NextRequest) {
  const body = await request.json();

  const result = createTeamMemberSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({
      error: "Validierungsfehler",
      details: result.error.flatten()
    }, { status: 400 });
  }

  const { email, name, password, role } = result.data;
  // ... rest
}
```

---

### 3.6 Rate Limiting implementieren

**Installation:**
```bash
npm install @upstash/ratelimit @upstash/redis
# oder für einfache In-Memory Lösung:
npm install express-rate-limit
```

**Beispiel mit Upstash:**
```typescript
// src/lib/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
});

export const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "60 s"), // 10 requests per minute
});

// In API-Route:
export async function POST(request: NextRequest) {
  const ip = request.ip ?? "127.0.0.1";
  const { success } = await ratelimit.limit(ip);

  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  // ...
}
```

---

## Checkliste

### Phase 1 - KRITISCH
- [x] Lexware API-Key aus Code entfernen (3 Dateien) ✅ 2026-02-04
- [x] Command Injection in obj-to-glb fixen ✅ 2026-02-04 (spawn statt exec, sichere Dateinamen)
- [x] Auth zu /api/setup/fix-permissions hinzufügen ✅ 2026-02-04 (nur superadmin)
- [x] Auth zu /api/lexware/import-quotes hinzufügen ✅ 2026-02-04
- [x] Auth zu /api/lexware/customers hinzufügen ✅ 2026-02-04
- [x] Auth zu /api/lexware/export-quote hinzufügen ✅ 2026-02-04
- [x] Auth zu /api/lexware/quote-pdf hinzufügen ✅ 2026-02-04
- [ ] .env.local aus Git-History entfernen (MANUELL - Team informieren!)
- [ ] Alle Credentials rotieren (MANUELL - nach Deployment)

### Phase 2 - HOCH
- [x] Passwort nicht mehr in Response zurückgeben ✅ 2026-02-04 (nur tempPassword bei Generierung)
- [x] Kryptografische Passwort-Generierung ✅ 2026-02-04 (crypto.randomBytes)
- [x] IDOR Fix für Documents API ✅ 2026-02-04 (Ownership-Check für Kunden)
- [x] IDOR Fix für Customer Login APIs ✅ 2026-02-04 (Auth-Check hinzugefügt)
- [ ] Next.js auf 15.4.7+ updaten

### Phase 3 - MITTEL
- [x] Security Headers in Middleware ✅ 2026-02-04
- [x] Console.logs aus API-Routes entfernen ✅ 2026-02-04 (alle /api Dateien)
- [ ] TypeScript strict mode aktivieren
- [ ] ESLint aktivieren
- [x] Passwort-Policy auf 12+ Zeichen ✅ 2026-02-04 (partner/team)
- [ ] Input-Validierung mit Zod
- [ ] Rate Limiting implementieren

---

## Referenzen

- [OWASP Top 10](https://owasp.org/Top10/)
- [Next.js Security](https://nextjs.org/docs/app/building-your-application/configuring/security-headers)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/auth/managing-user-data)
