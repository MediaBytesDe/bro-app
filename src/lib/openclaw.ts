type OpenClawMessage = {
  type: string;
  id?: string;
  method?: string;
  params?: Record<string, unknown>;
  content?: string;
  event?: string;
  payload?: any;
  ok?: boolean;
  error?: { message?: string };
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
        // Wait for connect.challenge event
      };

      this.ws.onmessage = (e) => {
        const data = JSON.parse(e.data);

        // Server sends challenge → we respond with connect
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
    // Chat response events (streaming content)
    if (data.type === 'event' && data.event === 'chat') {
      const payload = data.payload as any;
      const runId = payload?.runId;
      if (runId && this.messageQueue.has(runId)) {
        const pending = this.messageQueue.get(runId)!;
        // Streaming delta
        if (payload.state === 'delta' && payload.message) {
          pending.content = payload.message; // OpenClaw sends cumulative content
        }
        // Final state
        if (payload.state === 'final') {
          pending.resolve(pending.content);
          this.messageQueue.delete(runId);
        }
      }
    }

    // Response to chat.send
    if (data.type === 'res' && data.id) {
      // chat.send returns runId, we track with it
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
    const runId = crypto.randomUUID(); // idempotencyKey becomes runId

    return new Promise((resolve, reject) => {
      // Register with runId for chat events
      this.messageQueue.set(runId, { resolve, content: '' });

      // Timeout after 120 seconds (agents can take longer)
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
          deliver: false // Don't send to channel
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
