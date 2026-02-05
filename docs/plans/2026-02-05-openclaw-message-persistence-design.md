# OpenClaw Message Persistence Design

**Erstellt:** 2026-02-05
**Status:** Approved

## Ziel

Persistent storage für OpenClaw Chat-Nachrichten, damit Konversationen nach Reload erhalten bleiben.

## Anforderungen

- Jeder Agent (main, einkauf, kundenservice) hat eigene Chat-Historie
- Letzte 50 Nachrichten pro Agent werden beim Laden angezeigt
- WebSocket-Verbindung nur aktiv wenn Chat-Seite geöffnet
- Separate Message-Arrays pro Agent im Frontend

## Datenbank-Schema

### Tabelle: `openclaw_messages`

```sql
CREATE TABLE openclaw_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent TEXT NOT NULL,  -- 'main', 'einkauf', 'kundenservice'
  role TEXT NOT NULL,   -- 'user', 'assistant'
  content TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indizes
CREATE INDEX idx_openclaw_messages_agent_created ON openclaw_messages(agent, created_at DESC);
CREATE INDEX idx_openclaw_messages_user ON openclaw_messages(user_id);
```

### RLS Policies

- Users können nur ihre eigenen Nachrichten sehen und erstellen
- Admin/Mitarbeiter/Superadmin können alle Nachrichten sehen

## Server Actions

**Datei:** `src/app/actions/openclaw-messages.ts`

### `saveMessage(agent, role, content)`

- Speichert neue Nachricht in DB
- Holt `user_id` aus Session
- Return: Gespeicherte Message mit ID und Timestamp

### `loadMessages(agent, limit = 50, offset = 0)`

- Lädt letzte N Nachrichten für Agent
- Sortiert nach `created_at DESC`
- Return: Array von Messages

## Frontend-Änderungen

**Datei:** `src/app/(app)/openclaw/page.tsx`

### State-Management

```tsx
const [messagesByAgent, setMessagesByAgent] = useState<{
  main: Message[];
  einkauf: Message[];
  kundenservice: Message[];
}>({
  main: [],
  einkauf: [],
  kundenservice: []
});
```

### Lazy Loading

- Messages werden nur geladen wenn Agent-Tab aktiviert wird
- useEffect lädt Messages für aktiven Agent

### Message-Flow

```
User tippt → saveMessage("main", "user", text) → Optimistic Update
→ ask(text, "main") → saveMessage("main", "assistant", response)
```

## WebSocket Lifecycle

```tsx
useEffect(() => {
  // WebSocket öffnet automatisch beim ersten ask()

  return () => {
    // Cleanup: WebSocket schließen beim Unmount
    const client = getOpenClawClient();
    client.disconnect();
  };
}, []);
```

## Implementierung

1. Migration für `openclaw_messages` Tabelle
2. Server Actions (`saveMessage`, `loadMessages`)
3. Frontend State-Updates (separate Arrays pro Agent)
4. WebSocket Cleanup bei Unmount
5. RLS Policies

## Testing

- [ ] Nachricht senden → in DB gespeichert
- [ ] Reload → Nachrichten werden geladen
- [ ] Agent wechseln → korrektes Message-Array
- [ ] Seite verlassen → WebSocket schließt
- [ ] Zurück zur Seite → WebSocket reconnect
