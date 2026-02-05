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
