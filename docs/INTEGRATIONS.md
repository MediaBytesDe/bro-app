# BROjekt App - Integrations Research

> **Stand:** 02.02.2026  
> **Autor:** Integration-Research Subagent

---

## Inhaltsverzeichnis

1. [Executive Summary](#executive-summary)
2. [Lexware API](#lexware-api)
3. [Microsoft Graph API (OneDrive)](#microsoft-graph-api-onedrive)
4. [Empfehlungen](#empfehlungen)
5. [Nächste Schritte](#nächste-schritte)

---

## Executive Summary

| Kriterium | Lexware API | Microsoft Graph (OneDrive) |
|-----------|-------------|---------------------------|
| **API-Typ** | REST (JSON) | REST (JSON) |
| **Auth** | Bearer Token (API Key) | OAuth 2.0 |
| **Rate Limits** | 2 req/sec | Großzügig (ca. 10.000/Tag) |
| **SDK** | Kein offizielles SDK | `@microsoft/microsoft-graph-client` |
| **Kosten** | In Lexware-Abo enthalten | Kostenlos (M365 Lizenz) |
| **Empfehlung** | ✅ **Nutzen** | ✅ **Nutzen** |

---

## Lexware API

### 1. Produkt-Überblick

**Wichtig:** Die Lexware-Produktfamilie unterscheidet sich stark:

| Produkt | API verfügbar? | Empfehlung |
|---------|---------------|------------|
| **Lexware (Cloud)** | ✅ Vollständige REST API | **Empfohlen für BROjekt** |
| Lexware buchhaltung (Desktop) | ❌ Keine moderne API | Nicht geeignet |
| Lexware faktura+auftrag (Desktop) | ❌ Keine moderne API | Nicht geeignet |
| lexoffice | ⚠️ Eigene API (separates Produkt) | Alternative |

**Hinweis:** `developers.lexoffice.io` leitet jetzt auf `developers.lexware.io` weiter - Lexware hat die APIs konsolidiert.

### 2. API-Basis

```
Base URL: https://api.lexware.io
Dokumentation: https://developers.lexware.io/docs/
```

### 3. Authentifizierung

**Typ:** Bearer Token (API Key)

Der API-Key wird direkt im Lexware-Account generiert:
1. Einloggen unter [app.lexware.de](https://app.lexware.de)
2. Navigieren zu: **Einstellungen → Öffentliche API**
3. API-Key generieren

```typescript
// Beispiel: Header für alle Requests
const headers = {
  'Authorization': `Bearer ${LEXWARE_API_KEY}`,
  'Content-Type': 'application/json',
  'Accept': 'application/json'
};
```

### 4. Relevante Endpoints für BROjekt

#### 4.1 Kontakte (Kunden anlegen)

```http
POST /v1/contacts
GET /v1/contacts
GET /v1/contacts/{id}
PUT /v1/contacts/{id}
```

**Beispiel: Kunde anlegen**

```typescript
interface LexwareContact {
  version: number;
  roles: {
    customer?: {};
    vendor?: {};
  };
  company?: {
    name: string;
    taxNumber?: string;
    vatRegistrationId?: string;
    contactPersons?: Array<{
      salutation?: string;
      firstName?: string;
      lastName: string;
      primary?: boolean;
      emailAddress?: string;
      phoneNumber?: string;
    }>;
  };
  person?: {
    salutation?: string;
    firstName?: string;
    lastName: string;
  };
  addresses?: {
    billing?: Array<{
      street: string;
      zip: string;
      city: string;
      countryCode: string; // ISO 3166-2 (z.B. "DE")
    }>;
  };
  emailAddresses?: {
    business?: string[];
  };
}

// POST https://api.lexware.io/v1/contacts
const newCustomer: LexwareContact = {
  version: 0,
  roles: { customer: {} },
  company: {
    name: "Musterfirma GmbH",
    contactPersons: [{
      firstName: "Max",
      lastName: "Mustermann",
      primary: true,
      emailAddress: "max@musterfirma.de"
    }]
  },
  addresses: {
    billing: [{
      street: "Musterstraße 1",
      zip: "12345",
      city: "Musterstadt",
      countryCode: "DE"
    }]
  }
};
```

#### 4.2 Angebote (Quotations)

```http
POST /v1/quotations
GET /v1/quotations
GET /v1/quotations/{id}
PUT /v1/quotations/{id}
```

**Beispiel: Angebot erstellen**

```typescript
interface LexwareQuotation {
  voucherDate: string; // ISO 8601
  expirationDate?: string;
  address: {
    contactId?: string; // Referenz auf Kontakt
    name?: string;
    street?: string;
    zip?: string;
    city?: string;
    countryCode?: string;
  };
  lineItems: Array<{
    type: 'custom' | 'service' | 'material' | 'text';
    name: string;
    description?: string;
    quantity: number;
    unitName: string;
    unitPrice: {
      currency: 'EUR';
      netAmount: number;
      taxRatePercentage: number; // 0, 7, oder 19
    };
  }>;
  totalPrice: {
    currency: 'EUR';
  };
  taxConditions: {
    taxType: 'net' | 'gross';
  };
  title?: string;
  introduction?: string;
  remark?: string;
}

// POST https://api.lexware.io/v1/quotations
const quotation: LexwareQuotation = {
  voucherDate: "2026-02-02T00:00:00.000+01:00",
  expirationDate: "2026-03-02T00:00:00.000+01:00",
  address: {
    contactId: "uuid-des-kunden"
  },
  lineItems: [{
    type: 'service',
    name: 'Webdesign Projekt',
    description: 'Responsive Website inkl. CMS',
    quantity: 1,
    unitName: 'Pauschal',
    unitPrice: {
      currency: 'EUR',
      netAmount: 5000.00,
      taxRatePercentage: 19
    }
  }],
  totalPrice: { currency: 'EUR' },
  taxConditions: { taxType: 'net' },
  title: 'Angebot Website-Relaunch'
};
```

#### 4.3 Rechnungen (Invoices)

```http
POST /v1/invoices
POST /v1/invoices?finalize=true  # Direkt finalisieren
GET /v1/invoices
GET /v1/invoices/{id}
```

**Workflow: Angebot → Rechnung**

```typescript
// Rechnung aus Angebot erstellen (pursue)
// POST /v1/invoices?precedingSalesVoucherId={quotationId}
```

#### 4.4 Artikel/Produkte

```http
POST /v1/articles
GET /v1/articles
GET /v1/articles/{id}
PUT /v1/articles/{id}
DELETE /v1/articles/{id}
```

### 5. Rate Limits

| Limit | Wert |
|-------|------|
| Requests pro Sekunde | **2** |
| Algorithmus | Token Bucket |
| Bei Überschreitung | HTTP 429 |
| Blockade-Dauer | Sekunden bis Minuten |

**Best Practices:**
```typescript
// Rate Limiter implementieren
import Bottleneck from 'bottleneck';

const limiter = new Bottleneck({
  minTime: 500, // 2 req/sec = 500ms zwischen Requests
  maxConcurrent: 1
});

const lexwareRequest = limiter.wrap(async (endpoint: string, options: RequestInit) => {
  return fetch(`https://api.lexware.io${endpoint}`, options);
});
```

### 6. SDK/Libraries

**Kein offizielles SDK!** Empfehlung: Eigenen Client bauen.

```typescript
// src/lib/lexware/client.ts
import Bottleneck from 'bottleneck';

export class LexwareClient {
  private baseUrl = 'https://api.lexware.io';
  private limiter: Bottleneck;
  
  constructor(private apiKey: string) {
    this.limiter = new Bottleneck({
      minTime: 500,
      maxConcurrent: 1
    });
  }
  
  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown
  ): Promise<T> {
    return this.limiter.schedule(async () => {
      const res = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: body ? JSON.stringify(body) : undefined
      });
      
      if (!res.ok) {
        throw new Error(`Lexware API Error: ${res.status}`);
      }
      
      return res.json();
    });
  }
  
  // Contacts
  async createContact(contact: LexwareContact) {
    return this.request<{ id: string }>('POST', '/v1/contacts', contact);
  }
  
  async getContact(id: string) {
    return this.request<LexwareContact>('GET', `/v1/contacts/${id}`);
  }
  
  // Quotations
  async createQuotation(quotation: LexwareQuotation) {
    return this.request<{ id: string }>('POST', '/v1/quotations', quotation);
  }
  
  // Invoices
  async createInvoice(invoice: LexwareInvoice, finalize = false) {
    const query = finalize ? '?finalize=true' : '';
    return this.request<{ id: string }>('POST', `/v1/invoices${query}`, invoice);
  }
  
  async createInvoiceFromQuotation(quotationId: string, finalize = false) {
    const params = new URLSearchParams({
      precedingSalesVoucherId: quotationId,
      ...(finalize && { finalize: 'true' })
    });
    return this.request<{ id: string }>('POST', `/v1/invoices?${params}`);
  }
}
```

### 7. Kosten

- **Keine zusätzlichen API-Kosten** - im Lexware-Abo enthalten
- Lexware-Abo-Preise: ~10-50€/Monat je nach Paket

---

## Microsoft Graph API (OneDrive)

### 1. Überblick

Microsoft Graph ist die zentrale API für alle Microsoft 365 Dienste inkl. OneDrive.

```
Base URL: https://graph.microsoft.com/v1.0
Dokumentation: https://learn.microsoft.com/en-us/graph/
```

### 2. App Registration (Azure AD)

**Voraussetzung:** Azure Active Directory / Microsoft Entra ID

#### Setup-Schritte:

1. **Azure Portal** → Microsoft Entra ID → App registrations
2. **New registration:**
   - Name: "BROjekt App"
   - Supported account types: "Accounts in this organizational directory only"
   - Redirect URI: `http://localhost:3000/api/auth/callback/microsoft`

3. **API Permissions hinzufügen:**
   - `Files.ReadWrite` (Delegated) - Dateien lesen/schreiben
   - `Files.ReadWrite.All` (Delegated) - Alle Dateien
   - `offline_access` - Refresh Tokens
   - `User.Read` - Benutzer-Profil

4. **Client Secret erstellen:**
   - Certificates & secrets → New client secret
   - Gültigkeit: 24 Monate empfohlen

### 3. Authentifizierung (OAuth 2.0)

**Flow für Web-Apps:** Authorization Code Flow mit PKCE

```typescript
// .env
MICROSOFT_CLIENT_ID=your-client-id
MICROSOFT_CLIENT_SECRET=your-client-secret
MICROSOFT_TENANT_ID=your-tenant-id
```

#### Mit NextAuth.js (Empfohlen für Next.js)

```typescript
// src/app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';

export const authOptions = {
  providers: [
    MicrosoftEntraID({
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      tenantId: process.env.MICROSOFT_TENANT_ID,
      authorization: {
        params: {
          scope: 'openid profile email offline_access Files.ReadWrite Files.ReadWrite.All'
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      return session;
    }
  }
};

export const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

### 4. Relevante Endpoints für BROjekt

#### 4.1 Ordner erstellen

```http
POST /me/drive/root/children
POST /me/drive/items/{parent-id}/children
```

**Beispiel: Projektordner-Struktur erstellen**

```typescript
interface DriveItem {
  id: string;
  name: string;
  folder?: { childCount: number };
  webUrl?: string;
}

async function createFolder(
  accessToken: string,
  parentId: string,
  name: string
): Promise<DriveItem> {
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/items/${parentId}/children`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'rename' // oder 'fail', 'replace'
      })
    }
  );
  return res.json();
}

// Projektordner-Struktur für BROjekt
async function createProjectStructure(accessToken: string, projectName: string) {
  // Root: /BROjekt Projekte/{Projektname}/
  const rootFolder = await createFolder(accessToken, 'root', 'BROjekt Projekte');
  const projectFolder = await createFolder(accessToken, rootFolder.id, projectName);
  
  // Unterordner erstellen
  const subfolders = [
    '01_Angebote',
    '02_Verträge',
    '03_Rechnungen',
    '04_Korrespondenz',
    '05_Projektdateien',
    '06_Abnahme'
  ];
  
  const folders: Record<string, DriveItem> = {};
  for (const subfolder of subfolders) {
    folders[subfolder] = await createFolder(accessToken, projectFolder.id, subfolder);
  }
  
  return { projectFolder, subfolders: folders };
}
```

#### 4.2 Dateien hochladen

**Kleine Dateien (< 4MB):**

```http
PUT /me/drive/items/{parent-id}:/{filename}:/content
```

```typescript
async function uploadFile(
  accessToken: string,
  parentId: string,
  filename: string,
  content: Buffer | Blob
): Promise<DriveItem> {
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/items/${parentId}:/${filename}:/content`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/octet-stream'
      },
      body: content
    }
  );
  return res.json();
}
```

**Große Dateien (> 4MB):** Upload Session verwenden

```typescript
async function uploadLargeFile(
  accessToken: string,
  parentId: string,
  filename: string,
  file: File
): Promise<DriveItem> {
  // 1. Upload Session erstellen
  const sessionRes = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/items/${parentId}:/${filename}:/createUploadSession`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        item: {
          '@microsoft.graph.conflictBehavior': 'rename'
        }
      })
    }
  );
  
  const { uploadUrl } = await sessionRes.json();
  
  // 2. Chunks hochladen (max 60MB pro Chunk)
  const chunkSize = 10 * 1024 * 1024; // 10MB
  let start = 0;
  let result: DriveItem;
  
  while (start < file.size) {
    const end = Math.min(start + chunkSize, file.size);
    const chunk = file.slice(start, end);
    
    const chunkRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Range': `bytes ${start}-${end - 1}/${file.size}`
      },
      body: chunk
    });
    
    result = await chunkRes.json();
    start = end;
  }
  
  return result!;
}
```

#### 4.3 Sharing-Links erstellen

```http
POST /me/drive/items/{item-id}/createLink
```

```typescript
interface SharingLink {
  id: string;
  link: {
    type: string;
    scope: string;
    webUrl: string;
  };
}

async function createSharingLink(
  accessToken: string,
  itemId: string,
  options: {
    type: 'view' | 'edit';
    scope?: 'anonymous' | 'organization';
    expirationDateTime?: string;
    password?: string;
  }
): Promise<SharingLink> {
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/drive/items/${itemId}/createLink`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: options.type,
        scope: options.scope || 'organization',
        expirationDateTime: options.expirationDateTime,
        password: options.password
      })
    }
  );
  return res.json();
}

// Beispiel: Freigabe-Link für Kunden
const shareLink = await createSharingLink(accessToken, projectFolderId, {
  type: 'view',
  scope: 'anonymous', // Auch ohne Microsoft-Konto nutzbar
  expirationDateTime: '2026-03-01T00:00:00Z'
});
console.log(shareLink.link.webUrl); // https://1drv.ms/...
```

### 5. SDK für Node.js/TypeScript

**Offizielles SDK:** `@microsoft/microsoft-graph-client`

```bash
npm install @microsoft/microsoft-graph-client @azure/identity
```

```typescript
// src/lib/onedrive/client.ts
import { Client } from '@microsoft/microsoft-graph-client';
import 'isomorphic-fetch';

export function createGraphClient(accessToken: string): Client {
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    }
  });
}

// Nutzung
const client = createGraphClient(session.accessToken);

// Ordner erstellen
const folder = await client
  .api('/me/drive/root/children')
  .post({
    name: 'Neuer Ordner',
    folder: {},
    '@microsoft.graph.conflictBehavior': 'rename'
  });

// Dateien auflisten
const files = await client
  .api('/me/drive/root/children')
  .get();

// Datei hochladen (klein)
const uploaded = await client
  .api('/me/drive/root:/test.txt:/content')
  .put('Dateiinhalt');
```

### 6. Best Practices für Projektordner-Struktur

**Empfohlene Struktur für BROjekt:**

```
📁 BROjekt Projekte/
├── 📁 {Kundennummer}_{Projektname}/
│   ├── 📁 01_Angebote/
│   │   └── Angebot_2026-001.pdf
│   ├── 📁 02_Verträge/
│   ├── 📁 03_Rechnungen/
│   │   ├── Rechnung_RE-001.pdf
│   │   └── Rechnung_RE-002.pdf
│   ├── 📁 04_Korrespondenz/
│   ├── 📁 05_Projektdateien/
│   │   ├── 📁 Design/
│   │   ├── 📁 Dokumente/
│   │   └── 📁 Medien/
│   └── 📁 06_Abnahme/
└── 📁 _Vorlagen/
    ├── Angebots-Vorlage.docx
    └── Vertrag-Vorlage.docx
```

**Naming Convention:**
- Projekte: `{KUNDENNR}_{PROJEKTNAME}` (z.B. `K001_Website-Relaunch`)
- Dokumente: `{TYP}_{NUMMER}_{DATUM}.{EXT}` (z.B. `Angebot_A2026-001_2026-02-02.pdf`)

### 7. Rate Limits

Microsoft Graph hat großzügige Limits:

| Limit | Wert |
|-------|------|
| Pro App + User | ~10.000 Requests/10 Min |
| Throttling Response | HTTP 429 + Retry-After Header |

```typescript
// Retry-Logic implementieren
async function graphRequestWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      if (error.statusCode === 429 && i < maxRetries - 1) {
        const retryAfter = parseInt(error.headers?.['retry-after'] || '5');
        await new Promise(r => setTimeout(r, retryAfter * 1000));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}
```

---

## Empfehlungen

### Lexware

| Aspekt | Empfehlung |
|--------|------------|
| **Produkt** | Lexware Cloud (nicht Desktop-Versionen) |
| **Auth** | API-Key im Environment speichern |
| **SDK** | Eigenen Client bauen (siehe Beispiel oben) |
| **Rate Limiting** | `bottleneck` Library verwenden |
| **Sync-Strategie** | Bei Projekt-Erstellung sofort Kunde + Angebot anlegen |

### OneDrive

| Aspekt | Empfehlung |
|--------|------------|
| **Auth** | NextAuth.js mit Microsoft Provider |
| **SDK** | `@microsoft/microsoft-graph-client` |
| **Ordnerstruktur** | Einheitliches Schema (siehe oben) |
| **Sharing** | Organization-Links für interne, Anonymous für Kunden |
| **Uploads** | Upload Sessions für große Dateien |

### Architektur-Empfehlung

```
┌─────────────────────────────────────────────────────────────┐
│                      BROjekt App                            │
├─────────────────────────────────────────────────────────────┤
│  Frontend (Next.js)                                         │
│  └── Projekt erstellen → API Route aufrufen                 │
├─────────────────────────────────────────────────────────────┤
│  API Routes (/api/*)                                        │
│  ├── /api/projects/create                                   │
│  │   ├── 1. Lexware: Kontakt anlegen (falls neu)           │
│  │   ├── 2. Lexware: Angebot erstellen                     │
│  │   ├── 3. OneDrive: Projektordner erstellen              │
│  │   └── 4. DB: Projekt speichern mit Referenzen           │
│  └── /api/invoices/create                                   │
│      └── Lexware: Rechnung aus Angebot erstellen           │
├─────────────────────────────────────────────────────────────┤
│  Services                                                   │
│  ├── LexwareClient (eigener Client)                        │
│  └── OneDriveClient (@microsoft/microsoft-graph-client)    │
└─────────────────────────────────────────────────────────────┘
```

---

## Nächste Schritte

### Phase 1: Setup (1-2 Tage)
- [ ] Lexware-Account mit API-Zugang besorgen
- [ ] Azure App Registration erstellen
- [ ] Environment Variables konfigurieren
- [ ] NextAuth.js mit Microsoft Provider einrichten

### Phase 2: Basis-Integration (3-5 Tage)
- [ ] LexwareClient implementieren
  - [ ] Kontakte CRUD
  - [ ] Angebote erstellen
  - [ ] Rechnungen erstellen
- [ ] OneDrive-Integration implementieren
  - [ ] Ordner erstellen
  - [ ] Dateien hochladen
  - [ ] Sharing-Links

### Phase 3: Projekt-Workflow (2-3 Tage)
- [ ] "Neues Projekt" Flow implementieren
  - [ ] Kunde in Lexware anlegen (falls neu)
  - [ ] Projektordner in OneDrive erstellen
  - [ ] Angebot erstellen und hochladen
- [ ] "Rechnung erstellen" Flow implementieren

### Phase 4: Optimierung (ongoing)
- [ ] Error Handling & Retry Logic
- [ ] Caching für häufige Abfragen
- [ ] Webhooks für Echtzeit-Updates (falls verfügbar)
- [ ] Tests schreiben

---

## Ressourcen

### Lexware
- [API Dokumentation](https://developers.lexware.io/docs/)
- [Cookbooks (DE)](https://developers.lexware.io/cookbooks/)
- [Lexware Portal](https://app.lexware.de)

### Microsoft Graph
- [Graph Explorer](https://developer.microsoft.com/en-us/graph/graph-explorer)
- [API Referenz](https://learn.microsoft.com/en-us/graph/api/overview)
- [OneDrive API](https://learn.microsoft.com/en-us/graph/onedrive-concept-overview)
- [TypeScript SDK](https://github.com/microsoftgraph/msgraph-sdk-javascript)

### Libraries (npm)
- `@microsoft/microsoft-graph-client` - Graph SDK
- `@azure/identity` - Azure Auth
- `next-auth` - NextAuth.js
- `bottleneck` - Rate Limiting
