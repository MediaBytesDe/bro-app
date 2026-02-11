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
  result?: any;
};

export class OpenClawClient {
  private ws: WebSocket | null = null;
  private connected = false;
  private pendingRequests: Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
  }> = new Map();
  private chatListeners: Map<string, {
    resolve: (value: string) => void;
    content: string;
  }> = new Map();

  constructor(
    private url = process.env.OPENCLAW_URL || 'ws://localhost:18789/ws',
    private password = process.env.OPENCLAW_PASSWORD || 'BROjekt-2026!'
  ) {}

  async connect(): Promise<void> {
    if (this.connected && this.ws?.readyState === WebSocket.OPEN) return;

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        // Wait for connect.challenge event
      };

      this.ws.onmessage = (e) => {
        const data: OpenClawMessage = JSON.parse(e.data);

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

        // Response to a request (e.g. chat.send)
        if (data.type === 'res' && data.id) {
          const pending = this.pendingRequests.get(data.id);
          if (pending) {
            this.pendingRequests.delete(data.id);
            if (data.ok === false) {
              pending.reject(new Error(data.error?.message || 'Request failed'));
            } else {
              // chat.send response contains runId
              const runId = data.result?.runId;
              if (runId) {
                // Transfer chat listener from reqId to actual runId
                const listener = this.chatListeners.get(data.id);
                if (listener) {
                  this.chatListeners.delete(data.id);
                  this.chatListeners.set(runId, listener);
                }
              }
              pending.resolve(data.result);
            }
          }
        }

        // Chat streaming events
        if (data.type === 'event' && data.event === 'chat') {
          const payload = data.payload as any;
          const runId = payload?.runId;

          if (runId && this.chatListeners.has(runId)) {
            const listener = this.chatListeners.get(runId)!;

            if (payload.state === 'delta' && payload.message) {
              const message = payload.message;
              if (typeof message === 'object' && message.content && Array.isArray(message.content)) {
                // Anthropic Messages API format - content blocks, OVERWRITE not append
                listener.content = message.content
                  .filter((block: any) => block.type === 'text')
                  .map((block: any) => block.text)
                  .join('');
              } else if (typeof message === 'string') {
                listener.content = message;
              }
            }

            if (payload.state === 'final') {
              // If final has message content, use it
              if (payload.message) {
                const message = payload.message;
                if (typeof message === 'object' && message.content && Array.isArray(message.content)) {
                  const finalContent = message.content
                    .filter((block: any) => block.type === 'text')
                    .map((block: any) => block.text)
                    .join('');
                  if (finalContent) listener.content = finalContent;
                } else if (typeof message === 'string' && message) {
                  listener.content = message;
                }
              }
              listener.resolve(listener.content);
              this.chatListeners.delete(runId);
            }

            if (payload.state === 'error') {
              listener.resolve(listener.content || `Error: ${payload.error || 'Unknown error'}`);
              this.chatListeners.delete(runId);
            }
          }
        }
      };

      this.ws.onerror = (err) => {
        reject(new Error('WebSocket error'));
      };

      this.ws.onclose = (e) => {
        this.connected = false;
        // Reject all pending
        for (const [, pending] of this.pendingRequests) {
          pending.reject(new Error('Connection closed'));
        }
        this.pendingRequests.clear();
        for (const [, listener] of this.chatListeners) {
          listener.resolve(listener.content || '');
        }
        this.chatListeners.clear();
      };
    });
  }

  async ask(message: string, sessionKey = 'agent:main:main'): Promise<string> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.connected) {
      await this.connect();
    }

    const reqId = `ask-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    return new Promise((resolve, reject) => {
      // Register chat listener keyed by reqId initially
      // Will be re-keyed to runId when we get the response
      this.chatListeners.set(reqId, { resolve, content: '' });

      // Register request handler to get runId
      this.pendingRequests.set(reqId, {
        resolve: () => {}, // handled by chat listener
        reject: (err) => {
          this.chatListeners.delete(reqId);
          reject(err);
        }
      });

      // Timeout after 180 seconds
      const timeout = setTimeout(() => {
        // Find and resolve any listener for this request
        if (this.chatListeners.has(reqId)) {
          const listener = this.chatListeners.get(reqId)!;
          this.chatListeners.delete(reqId);
          resolve(listener.content || 'Request timeout');
        }
        // Also check all listeners (in case it was re-keyed to runId)
        this.pendingRequests.delete(reqId);
      }, 180000);

      const origResolve = resolve;
      this.chatListeners.get(reqId)!.resolve = (value: string) => {
        clearTimeout(timeout);
        origResolve(value);
      };

      this.ws!.send(JSON.stringify({
        type: 'req',
        id: reqId,
        method: 'chat.send',
        params: {
          message,
          sessionKey,
          deliver: false,
          idempotencyKey: reqId
        }
      }));
    });
  }

  async askMain(message: string): Promise<string> {
    return this.ask(message, 'agent:main:main');
  }

  async askEinkauf(message: string): Promise<string> {
    return this.ask(message, 'agent:einkauf:main');
  }

  async askKundenservice(message: string): Promise<string> {
    return this.ask(message, 'agent:kundenservice:main');
  }

  async askContent(message: string): Promise<string> {
    return this.ask(message, 'agent:content:main');
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
    this.connected = false;
  }
}

// Singleton for reusable connection
let clientInstance: OpenClawClient | null = null;

export function getOpenClawClient(): OpenClawClient {
  if (!clientInstance) {
    clientInstance = new OpenClawClient();
  }
  return clientInstance;
}
