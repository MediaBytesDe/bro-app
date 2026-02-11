# OpenClaw AI Agent Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate OpenClaw AI agent system into BROjekt app for automated product categorization, price monitoring, and customer service capabilities.

**Architecture:** WebSocket-based real-time communication with OpenClaw gateway. OpenClawClient class manages connection lifecycle, message queue, and synchronous request/response pattern. React hooks provide easy component integration. API routes handle server-side agent communication.

**Tech Stack:** Next.js 15, TypeScript, WebSocket API, React Hooks, Supabase

**User Requirements:**
- Enable AI automation for product management tasks
- Support multiple specialized agents (main, einkauf/purchasing, kundenservice/customer service)
- Provide both UI-based chat interface and programmatic API access
- Store OpenClaw connection details in environment variables

---

## Task 1: Add Environment Variables for OpenClaw Configuration

**Files:**
- Modify: `.env.local`
- Create: `.env.example` (if doesn't exist)

**Step 1: Add OpenClaw environment variables**

Add to `.env.local`:

```env
# OpenClaw AI Agent Configuration
OPENCLAW_URL=ws://localhost:18789/ws
OPENCLAW_TOKEN=your_token_here
```

Expected: Variables available to Next.js server

**Step 2: Document environment variables**

If `.env.example` exists, add the same variables with placeholder values.
If not, create it with:

```env
# OpenClaw AI Agent Configuration
OPENCLAW_URL=ws://localhost:18789/ws
OPENCLAW_TOKEN=your_token_here
```

Expected: Template for other developers

**Step 3: Verify environment variables load**

Run: `npm run dev`
Check: Server starts without errors
Expected: No missing env var warnings

**Step 4: Commit**

```bash
git add .env.example
git commit -m "feat(config): add OpenClaw environment variables"
```

**Note:** `.env.local` should NOT be committed (already in .gitignore)

---

## Task 2: Create OpenClaw Client Library

**Files:**
- Create: `src/lib/openclaw.ts`

**Step 1: Create OpenClaw client class**

Create `src/lib/openclaw.ts`:

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
  private messageQueue: Map<string, {
    resolve: (value: string) => void;
    content: string;
  }> = new Map();

  constructor(
    private url = process.env.OPENCLAW_URL || 'ws://localhost:18789/ws',
    private token = process.env.OPENCLAW_TOKEN!
  ) {}

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.ws!.send(JSON.stringify({
          type: 'connect',
          params: { auth: { token: this.token } }
        }));
        resolve();
      };

      this.ws.onmessage = (e) => {
        const data: OpenClawMessage = JSON.parse(e.data);

        // Chat response events (streaming content)
        if (data.type === 'chat' && data.id) {
          const pending = this.messageQueue.get(data.id);
          if (pending) {
            pending.content += data.content || '';
          }
        }

        // Response complete
        if (data.type === 'res' && data.id) {
          const pending = this.messageQueue.get(data.id);
          if (pending) {
            pending.resolve(pending.content);
            this.messageQueue.delete(data.id);
          }
        }
      };

      this.ws.onerror = reject;
    });
  }

  /**
   * Stellt eine Frage an einen Agent und wartet auf die Antwort
   * @param message - Die Nachricht/Frage
   * @param sessionKey - Session Key (default: main agent)
   * @returns Die Agent-Antwort als String
   */
  async ask(message: string, sessionKey = 'agent:main:main'): Promise<string> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.connect();
    }

    const id = crypto.randomUUID();

    return new Promise((resolve, reject) => {
      this.messageQueue.set(id, { resolve, content: '' });

      // Timeout nach 60 Sekunden
      const timeout = setTimeout(() => {
        this.messageQueue.delete(id);
        reject(new Error('Request timeout'));
      }, 60000);

      const originalResolve = this.messageQueue.get(id)!.resolve;
      this.messageQueue.get(id)!.resolve = (value) => {
        clearTimeout(timeout);
        originalResolve(value);
      };

      this.ws!.send(JSON.stringify({
        type: 'req',
        id,
        method: 'chat.send',
        params: { message, sessionKey }
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

Expected: OpenClawClient class with WebSocket connection management

**Step 2: Verify TypeScript compilation**

Run: `npm run build`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/lib/openclaw.ts
git commit -m "feat(lib): add OpenClaw WebSocket client"
```

---

## Task 3: Create OpenClaw API Route

**Files:**
- Create: `src/app/api/openclaw/ask/route.ts`

**Step 1: Create API endpoint**

Create `src/app/api/openclaw/ask/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { OpenClawClient } from "@/lib/openclaw";

export async function POST(request: NextRequest) {
  try {
    // Auth check - only authenticated users
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check role - only admin/mitarbeiter/superadmin
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("auth_id", user.id)
      .single();

    if (!profile || !["admin", "mitarbeiter", "superadmin"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { message, agent = "main" } = await request.json();

    if (!message) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    const client = new OpenClawClient();

    try {
      const sessionKey = `agent:${agent}:main`;
      const response = await client.ask(message, sessionKey);

      return NextResponse.json({
        response,
        agent,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("OpenClaw error:", error);
      return NextResponse.json(
        { error: "Failed to get response" },
        { status: 500 }
      );
    } finally {
      client.disconnect();
    }
  } catch (error: unknown) {
    console.error("API error:", error);
    const message = error instanceof Error ? error.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

Expected: API endpoint with auth checks

**Step 2: Verify TypeScript compilation**

Run: `npm run build`
Expected: No TypeScript errors

**Step 3: Test API endpoint (manual)**

With dev server running, test with curl:
```bash
curl -X POST http://localhost:3000/api/openclaw/ask \
  -H "Content-Type: application/json" \
  -d '{"message": "Hallo", "agent": "main"}'
```

Expected: 401 Unauthorized (no auth token - this is correct)

**Step 4: Commit**

```bash
git add src/app/api/openclaw/ask/route.ts
git commit -m "feat(api): add OpenClaw ask endpoint with auth"
```

---

## Task 4: Create React Hook for OpenClaw

**Files:**
- Create: `src/hooks/useOpenClaw.ts`

**Step 1: Create React hook**

Create `src/hooks/useOpenClaw.ts`:

```typescript
"use client";

import { useState, useCallback } from "react";

interface UseOpenClawOptions {
  defaultAgent?: "main" | "einkauf" | "kundenservice";
}

interface AskResult {
  response: string;
  agent: string;
  timestamp: string;
}

export function useOpenClaw(options: UseOpenClawOptions = {}) {
  const { defaultAgent = "main" } = options;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<string | null>(null);

  const ask = useCallback(
    async (
      message: string,
      agent = defaultAgent
    ): Promise<string | null> => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/openclaw/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, agent }),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data: AskResult = await res.json();
        setLastResponse(data.response);
        return data.response;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [defaultAgent]
  );

  // Shortcut-Funktionen
  const askMain = useCallback(
    (message: string) => ask(message, "main"),
    [ask]
  );
  const askEinkauf = useCallback(
    (message: string) => ask(message, "einkauf"),
    [ask]
  );
  const askKundenservice = useCallback(
    (message: string) => ask(message, "kundenservice"),
    [ask]
  );

  return {
    ask,
    askMain,
    askEinkauf,
    askKundenservice,
    loading,
    error,
    lastResponse,
  };
}
```

Expected: React hook for OpenClaw integration

**Step 2: Verify TypeScript compilation**

Run: `npm run build`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/hooks/useOpenClaw.ts
git commit -m "feat(hooks): add useOpenClaw React hook"
```

---

## Task 5: Create OpenClaw Chat UI Page

**Files:**
- Create: `src/app/(app)/openclaw/page.tsx`

**Step 1: Create chat interface component**

Create `src/app/(app)/openclaw/page.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useOpenClaw } from "@/hooks/useOpenClaw";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Bot,
  Send,
  Loader2,
  AlertCircle,
  User,
} from "lucide-react";

const AGENTS = [
  { id: "main", name: "Bro (Main)", color: "blue" },
  { id: "einkauf", name: "Einkauf", color: "green" },
  { id: "kundenservice", name: "Kundenservice", color: "purple" },
] as const;

type AgentId = typeof AGENTS[number]["id"];

interface Message {
  role: "user" | "assistant";
  content: string;
  agent: AgentId;
  timestamp: string;
}

export default function OpenClawPage() {
  const [activeAgent, setActiveAgent] = useState<AgentId>("main");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);

  const { ask, loading, error } = useOpenClaw();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    const timestamp = new Date().toISOString();

    setInput("");

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: userMessage,
        agent: activeAgent,
        timestamp,
      },
    ]);

    const response = await ask(userMessage, activeAgent);

    if (response) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: response,
          agent: activeAgent,
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  };

  const activeAgentInfo = AGENTS.find((a) => a.id === activeAgent);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="p-6 border-b border-neutral-800">
        <h1 className="text-2xl font-semibold text-neutral-100 flex items-center gap-2">
          <Bot className="w-6 h-6" />
          OpenClaw AI Assistenten
        </h1>
        <p className="text-sm text-neutral-400 mt-1">
          Chatten Sie mit spezialisierten KI-Agenten
        </p>
      </div>

      {/* Agent Tabs */}
      <div className="flex border-b border-neutral-800 bg-neutral-900">
        {AGENTS.map((agent) => (
          <button
            key={agent.id}
            onClick={() => setActiveAgent(agent.id)}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeAgent === agent.id
                ? "bg-neutral-800 text-neutral-100 border-b-2 border-blue-500"
                : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
            }`}
          >
            {agent.name}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-6 space-y-4 bg-neutral-950">
        {messages.length === 0 && (
          <div className="text-center text-neutral-500 mt-8">
            <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Keine Nachrichten. Stellen Sie eine Frage an {activeAgentInfo?.name}.</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                <Bot className="w-5 h-5 text-white" />
              </div>
            )}

            <div
              className={`max-w-[80%] rounded-lg px-4 py-3 ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-neutral-800 text-neutral-100"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              <p className="text-xs opacity-50 mt-1">
                {new Date(msg.timestamp).toLocaleTimeString("de-DE")}
              </p>
            </div>

            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-neutral-300" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="bg-neutral-800 text-neutral-100 rounded-lg px-4 py-3">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="px-6 py-2">
          <Alert className="bg-red-900/20 border-red-900 text-red-300">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-neutral-800 p-4 bg-neutral-900">
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder={`Fragen Sie ${activeAgentInfo?.name}...`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            className="flex-1 bg-neutral-800 border-neutral-700 text-neutral-100 placeholder:text-neutral-500"
          />
          <Button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Senden
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
```

Expected: Full-featured chat UI with agent tabs

**Step 2: Verify TypeScript compilation**

Run: `npm run build`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/app/(app)/openclaw/page.tsx
git commit -m "feat(ui): add OpenClaw chat interface page"
```

---

## Task 6: Add Navigation Link to App Shell

**Files:**
- Modify: `src/components/app-shell.tsx`

**Step 1: Add OpenClaw to navigation**

Find the navigation groups in `src/components/app-shell.tsx` and add OpenClaw to an appropriate section (likely after "WAWI" or in a new "KI & Automatisierung" section):

```typescript
import { Bot, /* ...other icons */ } from "lucide-react";

// In the navigation structure:
{
  label: "KI & Automatisierung",
  items: [
    {
      id: "openclaw",
      path: "/openclaw",
      label: "OpenClaw",
      icon: Bot,
      description: "KI-Assistenten"
    },
  ]
}
```

If adding to existing WAWI section instead:

```typescript
{
  label: "WAWI",
  items: [
    // ... existing items
    {
      id: "openclaw",
      path: "/openclaw",
      label: "OpenClaw",
      icon: Bot,
      description: "KI-Assistenten"
    },
  ]
}
```

Expected: OpenClaw link appears in navigation

**Step 2: Verify navigation works**

Run: `npm run dev`
Check: OpenClaw link visible in navigation
Click: Should navigate to `/openclaw`
Expected: Chat interface loads

**Step 3: Commit**

```bash
git add src/components/app-shell.tsx
git commit -m "feat(nav): add OpenClaw to navigation"
```

---

## Task 7: Create Server Actions for OpenClaw (Optional Alternative)

**Files:**
- Create: `src/app/actions/openclaw.ts`

**Step 1: Create server action**

Create `src/app/actions/openclaw.ts`:

```typescript
"use server";

import { OpenClawClient } from "@/lib/openclaw";
import { createClient } from "@/lib/supabase/server";

export async function askBro(message: string, agent = "main") {
  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  // Check role
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("auth_id", user.id)
    .single();

  if (!profile || !["admin", "mitarbeiter", "superadmin"].includes(profile.role)) {
    return { success: false, error: "Forbidden" };
  }

  const client = new OpenClawClient();

  try {
    const response = await client.ask(message, `agent:${agent}:main`);
    return { success: true, response };
  } catch (error) {
    console.error("OpenClaw error:", error);
    return { success: false, error: "Request failed" };
  } finally {
    client.disconnect();
  }
}
```

Expected: Server action for OpenClaw queries

**Step 2: Verify TypeScript compilation**

Run: `npm run build`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add src/app/actions/openclaw.ts
git commit -m "feat(actions): add OpenClaw server actions"
```

**Note:** This is an alternative to the API route for use in server components and forms.

---

## Task 8: Update Documentation

**Files:**
- Modify: `docs/openclaw-nextjs-integration.md`

**Step 1: Add implementation status**

Add section at top of `docs/openclaw-nextjs-integration.md`:

```markdown
## Implementation Status

✅ **Implemented in BROjekt App:**
- OpenClawClient library (`src/lib/openclaw.ts`)
- API route (`src/app/api/openclaw/ask/route.ts`)
- React hook (`src/hooks/useOpenClaw.ts`)
- Chat UI page (`src/app/(app)/openclaw/page.tsx`)
- Server actions (`src/app/actions/openclaw.ts`)
- Navigation integration

**Environment Variables Required:**
- `OPENCLAW_URL` - WebSocket URL (default: `ws://localhost:18789/ws`)
- `OPENCLAW_TOKEN` - Gateway authentication token

**Access:** Navigate to `/openclaw` in the app (requires admin/mitarbeiter/superadmin role)

---
```

Expected: Documentation updated with implementation details

**Step 2: Commit**

```bash
git add docs/openclaw-nextjs-integration.md
git commit -m "docs: update OpenClaw integration status"
```

---

## Verification Plan

### Manual Testing Checklist

1. **Environment Setup:**
   - Verify `OPENCLAW_URL` and `OPENCLAW_TOKEN` are set in `.env.local`
   - Check that OpenClaw gateway is running: `openclaw status`
   - Expected: Gateway running on port 18789

2. **Build Verification:**
   ```bash
   npm run build
   ```
   Expected: No TypeScript errors, successful build

3. **Development Server:**
   ```bash
   npm run dev
   ```
   Expected: Server starts, no errors in console

4. **Navigation:**
   - Login as admin user
   - Check navigation menu for "OpenClaw" or "KI-Assistenten"
   - Click link
   - Expected: Navigate to `/openclaw`, chat UI loads

5. **Chat Interface:**
   - Select "Bro (Main)" tab (should be default)
   - Type "Hallo" in input field
   - Click "Senden" or press Enter
   - Expected: Loading indicator appears, then response from agent

6. **Agent Switching:**
   - Switch to "Einkauf" tab
   - Ask: "Aktuelle Modulpreise?"
   - Expected: Response from Einkauf agent (purchasing)
   - Switch to "Kundenservice" tab
   - Ask: "Öffnungszeiten?"
   - Expected: Response from Kundenservice agent

7. **Error Handling:**
   - Stop OpenClaw gateway: `openclaw stop`
   - Try sending message
   - Expected: Error message displayed (connection failed)
   - Restart gateway: `openclaw start`
   - Try again
   - Expected: Works normally

8. **API Route (curl test):**
   ```bash
   # Get auth token from browser cookies or Supabase dashboard
   curl -X POST http://localhost:3000/api/openclaw/ask \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_SUPABASE_TOKEN" \
     -d '{"message": "Test", "agent": "main"}'
   ```
   Expected: JSON response with agent reply

9. **Server Action (in component):**
   - Create test component using `askBro` action
   - Verify it works without API route
   - Expected: Same functionality as API route

10. **WebSocket Connection:**
    - Open browser DevTools Network tab
    - Navigate to `/openclaw`
    - Send message
    - Expected: See WebSocket connection in Network tab, messages flowing

### Build Verification

```bash
npm run build
```
Expected: Clean build, no errors

### TypeScript Check

```bash
npx tsc --noEmit
```
Expected: No type errors

---

## Integration Points for Future Automation

**Product Management:**
- Automatic product categorization using AI
- Price monitoring and update suggestions
- Duplicate detection

**Customer Service:**
- Automated responses to common questions
- Lead qualification
- Appointment scheduling suggestions

**Purchasing:**
- Price comparison and recommendations
- Supplier evaluation
- Inventory optimization suggestions

**Example Usage in Code:**

```typescript
// Automatic product categorization
import { askBro } from "@/app/actions/openclaw";

async function categorizeProduct(productName: string, description: string) {
  const result = await askBro(
    `Kategorisiere dieses Produkt: "${productName}". Beschreibung: "${description}". Antworte nur mit der Kategorie.`,
    "einkauf"
  );

  if (result.success) {
    return result.response;
  }
  return null;
}
```

---

## Success Criteria

✅ OpenClawClient class implemented with WebSocket connection
✅ API route with authentication and authorization
✅ React hook for easy component integration
✅ Full-featured chat UI with agent tabs
✅ Navigation link in app shell
✅ Server actions for alternative access pattern
✅ Documentation updated
✅ TypeScript compilation passes
✅ Manual testing complete
✅ All three agents (main, einkauf, kundenservice) accessible
✅ Error handling for connection failures
✅ Loading states and user feedback

---

## Notes

- WebSocket connections are client-side only (browser WebSocket API)
- Server-side communication goes through OpenClawClient in API routes
- Each request creates new connection (no persistent connection pooling)
- 60-second timeout per request (configurable in OpenClawClient)
- Authentication handled at API route level (Supabase auth)
- Authorization restricted to admin/mitarbeiter/superadmin roles
- Environment variables must be set before running app
- OpenClaw gateway must be running on configured port

---

*Created: 2026-02-05 | BROjekt GmbH*
