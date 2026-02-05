# OpenClaw Next.js Integration

> **✅ Getestet: 05.02.2026** - WebSocket-Verbindung funktioniert mit Protocol v3

## Implementation Status

✅ **Implemented in BROjekt App:**
- OpenClawClient library (`src/lib/openclaw.ts`) - Protocol v3
- API route (`src/app/api/openclaw/ask/route.ts`)
- React hook (`src/hooks/useOpenClaw.ts`)
- Chat UI page (`src/app/(app)/openclaw/page.tsx`)
- Server actions (`src/app/actions/openclaw.ts`)
- Navigation integration (System dropdown)

**Environment Variables Required:**
- `OPENCLAW_URL` - WebSocket URL (default: `ws://localhost:18789/ws`)
- `OPENCLAW_PASSWORD` - Gateway authentication password

**Access:** Navigate to `/openclaw` in the app (requires admin/mitarbeiter/superadmin role)

**Protocol Version:** v3 (tested and working as of 2026-02-05)

---

Diese Dokumentation beschreibt wie du OpenClaw (Bro) in eine Next.js App einbindest.

## Quick Reference - Connect Params

```json
{
  "type": "req",
  "id": "connect-1",
  "method": "connect",
  "params": {
    "minProtocol": 3,
    "maxProtocol": 3,
    "client": {
      "id": "gateway-client",
      "version": "1.0.0",
      "platform": "nodejs",
      "mode": "backend"
    },
    "role": "operator",
    "scopes": ["operator.read", "operator.write"],
    "auth": { "password": "BROjekt-2026!" }
  }
}
```

**Wichtig:** Server sendet zuerst `connect.challenge` Event → dann Connect Request senden!

### chat.send - Nachricht senden

```json
{"type":"req","id":"2","method":"chat.send","params":{"message":"Hallo!","sessionKey":"agent:einkauf:main","idempotencyKey":"req-001"}}
```

⚠️ **Alle 3 params sind Pflicht:** `message`, `sessionKey`, `idempotencyKey`

## Übersicht

- **WebSocket-Verbindung** zum Gateway für Echtzeit-Kommunikation
- **Synchrone Responses** - Warten auf Agent-Antwort
- **Multi-Agent Support** - Main, Einkauf, Kundenservice etc.

## Konfiguration

### Environment Variables (`.env.local`)

```env
OPENCLAW_URL=ws://localhost:18789/ws
# Für LAN-Zugriff:
# OPENCLAW_URL=ws://10.100.10.52:18789/ws

# Auth: Password ODER Token
OPENCLAW_PASSWORD=BROjekt-2026!
# OPENCLAW_TOKEN=dbbd46424c5a7eaea9888d068a24d3688375867b295030d1
```

> **Produktion:** Nutze `wss://` für verschlüsselte Verbindung über Tailscale/Reverse Proxy.

---

## 1. OpenClaw Client (`lib/openclaw.ts`)

```typescript
type OpenClawMessage = {
  type: string;
  id?: string;
  method?: string;
  params?: Record<string, unknown>;
  content?: string;
  event?: string;
};

export class OpenClawClient {
  private ws: WebSocket | null = null;
  private connected = false;
  private messageQueue: Map<string, {
    resolve: (value: string) => void;
    content: string;
  }> = new Map();
  
  constructor(
    private url = process.env.OPENCLAW_URL || 'ws://localhost:18789/ws',
    private password = process.env.OPENCLAW_PASSWORD || 'BROjekt-2026!'
  ) {}

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      
      this.ws.onopen = () => {
        // Warte auf connect.challenge Event
      };
      
      this.ws.onmessage = (e) => {
        const data = JSON.parse(e.data);
        
        // Server sendet challenge → wir antworten mit connect
        if (data.type === 'event' && data.event === 'connect.challenge') {
          this.ws!.send(JSON.stringify({
            type: 'req',
            id: 'connect-1',
            method: 'connect',
            params: {
              minProtocol: 3,
              maxProtocol: 3,
              client: {
                id: 'gateway-client',
                version: '1.0.0',
                platform: 'nodejs',
                mode: 'backend'
              },
              role: 'operator',
              scopes: ['operator.read', 'operator.write'],
              auth: { password: this.password }
            }
          }));
          return;
        }
        
        // Connect response
        if (data.type === 'res' && data.id === 'connect-1') {
          if (data.ok) {
            this.connected = true;
            resolve();
          } else {
            reject(new Error(data.error?.message || 'Connect failed'));
          }
          return;
        }
        
        this.handleMessage(data);
      };
      
      this.ws.onerror = reject;
      this.ws.onclose = (e) => {
        this.connected = false;
        if (!this.connected) {
          reject(new Error(`Connection closed: ${e.reason || e.code}`));
        }
      };
    });
  }
  
  private handleMessage(data: OpenClawMessage) {
      
  private handleMessage(data: OpenClawMessage) {
    // Chat response events (streaming content)
    if (data.type === 'event' && data.event === 'chat') {
      const payload = data.payload as any;
      const runId = payload?.runId;
      if (runId && this.messageQueue.has(runId)) {
        const pending = this.messageQueue.get(runId)!;
        // Streaming delta
        if (payload.state === 'delta' && payload.message) {
          pending.content = payload.message; // OpenClaw sendet kumulative Inhalte
        }
        // Final state
        if (payload.state === 'final') {
          pending.resolve(pending.content);
          this.messageQueue.delete(runId);
        }
      }
    }
    
    // Response auf chat.send
    if (data.type === 'res' && data.id) {
      // chat.send gibt runId zurück, wir tracken damit
    }
  }

  /**
   * Stellt eine Frage an einen Agent und wartet auf die Antwort
   * @param message - Die Nachricht/Frage
   * @param sessionKey - Session Key (default: main agent)
   * @returns Die Agent-Antwort als String
   */
  async ask(message: string, sessionKey = 'agent:main:main'): Promise<string> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.connected) {
      await this.connect();
    }
    
    const reqId = crypto.randomUUID();
    const runId = crypto.randomUUID(); // idempotencyKey wird zur runId
    
    return new Promise((resolve, reject) => {
      // Registriere mit runId für chat events
      this.messageQueue.set(runId, { resolve, content: '' });
      
      // Timeout nach 120 Sekunden (Agents können länger brauchen)
      const timeout = setTimeout(() => {
        this.messageQueue.delete(runId);
        reject(new Error('Request timeout'));
      }, 120000);
      
      const originalResolve = this.messageQueue.get(runId)!.resolve;
      this.messageQueue.get(runId)!.resolve = (value) => {
        clearTimeout(timeout);
        originalResolve(value);
      };
      
      this.ws!.send(JSON.stringify({
        type: 'req',
        id: reqId,
        method: 'chat.send',
        params: { 
          message, 
          sessionKey,
          idempotencyKey: runId,
          deliver: false // Nicht an Channel senden
        }
      }));
    });
  }

  /**
   * Shortcut für verschiedene Agents
   */
  async askMain(message: string): Promise<string> {
    return this.ask(message, 'agent:main:main');
  }

  async askEinkauf(message: string): Promise<string> {
    return this.ask(message, 'agent:einkauf:main');
  }

  async askKundenservice(message: string): Promise<string> {
    return this.ask(message, 'agent:kundenservice:main');
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
  }
}

// Singleton für wiederverwendbare Verbindung
let clientInstance: OpenClawClient | null = null;

export function getOpenClawClient(): OpenClawClient {
  if (!clientInstance) {
    clientInstance = new OpenClawClient();
  }
  return clientInstance;
}
```

---

## 2. API Route (`app/api/ask/route.ts`)

```typescript
import { NextRequest } from 'next/server';
import { OpenClawClient } from '@/lib/openclaw';

export async function POST(req: NextRequest) {
  const { message, agent = 'main' } = await req.json();
  
  if (!message) {
    return Response.json({ error: 'Message required' }, { status: 400 });
  }
  
  const client = new OpenClawClient();
  
  try {
    const sessionKey = `agent:${agent}:main`;
    const response = await client.ask(message, sessionKey);
    
    return Response.json({ 
      response,
      agent,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('OpenClaw error:', error);
    return Response.json({ 
      error: 'Failed to get response' 
    }, { status: 500 });
  } finally {
    client.disconnect();
  }
}
```

---

## 3. React Hook (`hooks/useOpenClaw.ts`)

```typescript
'use client';

import { useState, useCallback } from 'react';

interface UseOpenClawOptions {
  defaultAgent?: 'main' | 'einkauf' | 'kundenservice';
}

interface AskResult {
  response: string;
  agent: string;
  timestamp: string;
}

export function useOpenClaw(options: UseOpenClawOptions = {}) {
  const { defaultAgent = 'main' } = options;
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<string | null>(null);
  
  const ask = useCallback(async (
    message: string, 
    agent = defaultAgent
  ): Promise<string | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, agent })
      });
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      
      const data: AskResult = await res.json();
      setLastResponse(data.response);
      return data.response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [defaultAgent]);
  
  // Shortcut-Funktionen
  const askMain = useCallback((message: string) => ask(message, 'main'), [ask]);
  const askEinkauf = useCallback((message: string) => ask(message, 'einkauf'), [ask]);
  const askKundenservice = useCallback((message: string) => ask(message, 'kundenservice'), [ask]);
  
  return { 
    ask,
    askMain,
    askEinkauf,
    askKundenservice,
    loading, 
    error,
    lastResponse
  };
}
```

---

## 4. Beispiel-Components

### Einfacher Chat

```tsx
'use client';

import { useState } from 'react';
import { useOpenClaw } from '@/hooks/useOpenClaw';

export function SimpleChat() {
  const { ask, loading, error, lastResponse } = useOpenClaw();
  const [input, setInput] = useState('');
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    await ask(input);
    setInput('');
  };
  
  return (
    <div className="p-4 max-w-xl mx-auto">
      <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Frag Bro..."
          className="flex-1 border rounded px-3 py-2"
          disabled={loading}
        />
        <button 
          type="submit"
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading ? '...' : 'Senden'}
        </button>
      </form>
      
      {error && (
        <div className="text-red-500 mb-4">Fehler: {error}</div>
      )}
      
      {lastResponse && (
        <div className="bg-gray-100 rounded p-4 whitespace-pre-wrap">
          {lastResponse}
        </div>
      )}
    </div>
  );
}
```

### Multi-Agent Tabs

```tsx
'use client';

import { useState } from 'react';
import { useOpenClaw } from '@/hooks/useOpenClaw';

const AGENTS = [
  { id: 'main', name: 'Bro (Main)', color: 'blue' },
  { id: 'einkauf', name: 'Einkauf', color: 'green' },
  { id: 'kundenservice', name: 'Kundenservice', color: 'purple' },
] as const;

export function MultiAgentChat() {
  const [activeAgent, setActiveAgent] = useState<string>('main');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Array<{
    role: 'user' | 'assistant';
    content: string;
    agent: string;
  }>>([]);
  
  const { ask, loading } = useOpenClaw();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    const userMessage = input;
    setInput('');
    
    setMessages(prev => [...prev, { 
      role: 'user', 
      content: userMessage,
      agent: activeAgent 
    }]);
    
    const response = await ask(userMessage, activeAgent);
    
    if (response) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: response,
        agent: activeAgent 
      }]);
    }
  };
  
  return (
    <div className="h-screen flex flex-col">
      {/* Agent Tabs */}
      <div className="flex border-b">
        {AGENTS.map(agent => (
          <button
            key={agent.id}
            onClick={() => setActiveAgent(agent.id)}
            className={`px-4 py-2 ${
              activeAgent === agent.id 
                ? `bg-${agent.color}-500 text-white` 
                : 'bg-gray-100'
            }`}
          >
            {agent.name}
          </button>
        ))}
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`${
            msg.role === 'user' ? 'text-right' : 'text-left'
          }`}>
            <div className={`inline-block max-w-[80%] rounded-lg px-4 py-2 ${
              msg.role === 'user' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && <div className="text-gray-400">Lädt...</div>}
      </div>
      
      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t p-4 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Frag ${AGENTS.find(a => a.id === activeAgent)?.name}...`}
          className="flex-1 border rounded px-3 py-2"
          disabled={loading}
        />
        <button 
          type="submit"
          disabled={loading}
          className="bg-blue-500 text-white px-6 py-2 rounded"
        >
          Senden
        </button>
      </form>
    </div>
  );
}
```

---

## 5. Server Actions (Alternative zu API Route)

```typescript
// app/actions/openclaw.ts
'use server';

import { OpenClawClient } from '@/lib/openclaw';

export async function askBro(message: string, agent = 'main') {
  const client = new OpenClawClient();
  
  try {
    const response = await client.ask(message, `agent:${agent}:main`);
    return { success: true, response };
  } catch (error) {
    return { success: false, error: 'Request failed' };
  } finally {
    client.disconnect();
  }
}
```

Nutzung in Component:

```tsx
import { askBro } from '@/app/actions/openclaw';

// In einem Form oder Button Handler
const result = await askBro('Aktuelle Modulpreise?', 'einkauf');
if (result.success) {
  console.log(result.response);
}
```

---

## Verfügbare Agents

| Agent ID | Session Key | Beschreibung | Heartbeat |
|----------|-------------|--------------|-----------|
| `main` | `agent:main:main` | Bro - Hauptassistent | ✅ 30m |
| `einkauf` | `agent:einkauf:main` | Einkauf/Pricing Agent | ❌ |
| `kundenservice` | `agent:kundenservice:main` | WhatsApp Kundenservice | ❌ |

## Verfügbare Methods (getestet)

### chat.send (⚠️ Pflichtfelder!)

```json
{
  "type": "req",
  "id": "unique-request-id",
  "method": "chat.send",
  "params": {
    "message": "Deine Nachricht",
    "sessionKey": "agent:einkauf:main",
    "idempotencyKey": "unique-key-123"
  }
}
```

| Parameter | Pflicht | Beschreibung |
|-----------|---------|--------------|
| `message` | ✅ | Die Nachricht an den Agent |
| `sessionKey` | ✅ | Ziel-Agent (`agent:main:main`, `agent:einkauf:main`, etc.) |
| `idempotencyKey` | ✅ | Eindeutiger Key (UUID) - verhindert Duplikate |
| `deliver` | ❌ | `false` = nicht an Channel senden (default für API) |

### Weitere Methods

```
chat.history      - Chat-Verlauf abrufen  
chat.abort        - Laufende Anfrage abbrechen
sessions.list     - Sessions auflisten
status            - Gateway Status
health            - Health Check
agents.list       - Agents auflisten
```

## Events (automatisch nach Connect)

```
chat              - Streaming-Antworten vom Agent
health            - Periodische Health-Updates
presence          - Präsenz-Updates
```

---

## Troubleshooting

### "WebSocket connection failed"
- Prüfe ob Gateway läuft: `openclaw status`
- Prüfe URL und Port (default: 18789)

### "Auth failed"
- Token in `.env.local` korrekt?
- Gateway Token: `~/.openclaw/openclaw.json` → `gateway.auth.token`

### Timeout
- Agent braucht länger? Timeout in `openclaw.ts` erhöhen
- Bei komplexen Aufgaben: Async mit Webhook statt WS

---

## Webhook Alternative (Fire & Forget)

Für Aufgaben ohne Warten auf Response:

```typescript
export async function triggerBro(text: string) {
  await fetch('http://localhost:18789/hooks/wake', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENCLAW_HOOK_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text, mode: 'now' })
  });
}
```

---

---

## Connection Flow

```
1. Client → Server: WebSocket connect
2. Server → Client: {"type":"event","event":"connect.challenge","payload":{"nonce":"..."}}
3. Client → Server: {"type":"req","method":"connect","params":{...}}
4. Server → Client: {"type":"res","ok":true,"payload":{"type":"hello-ok",...}}
5. Server → Client: Automatische Events (health, chat, etc.)
```

---

*Erstellt: 2026-02-05 | Aktualisiert: 2026-02-05 | BROjekt GmbH*
