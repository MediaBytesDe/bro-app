/**
 * OpenClaw Client - HTTP API based
 *
 * Uses the Gateway's /tools/invoke HTTP API with sessions_send tool.
 * This is simpler and more reliable than the WebSocket approach,
 * as it doesn't require device pairing for operator.write scope.
 */
export class OpenClawClient {
  private baseUrl: string;
  private password: string;

  constructor(
    url = process.env.OPENCLAW_URL || 'ws://localhost:18789/ws',
    password = process.env.OPENCLAW_PASSWORD || 'BROjekt-2026!'
  ) {
    // Convert WebSocket URL to HTTP URL for the tools/invoke API
    this.baseUrl = url
      .replace(/^wss:\/\//, 'https://')
      .replace(/^ws:\/\//, 'http://')
      .replace(/\/ws\/?$/, '');
    this.password = password;
  }

  async connect(): Promise<void> {
    // No-op: HTTP API doesn't need a persistent connection
  }

  /**
   * Stellt eine Frage an einen Agent und wartet auf die Antwort
   * @param message - Die Nachricht/Frage
   * @param sessionKey - Session Key (default: main agent)
   * @returns Die Agent-Antwort als String
   */
  async ask(message: string, sessionKey = 'agent:main:main'): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180000); // 3 min timeout

    try {
      const res = await fetch(`${this.baseUrl}/tools/invoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.password}`,
        },
        body: JSON.stringify({
          tool: 'sessions_send',
          args: {
            message,
            sessionKey,
          },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`OpenClaw API error (${res.status}): ${errorBody}`);
      }

      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.error?.message || 'OpenClaw request failed');
      }

      // Extract reply from the response
      const details = data.result?.details;
      if (details?.reply) {
        return details.reply;
      }

      // Fallback: try to extract from content blocks
      const content = data.result?.content;
      if (Array.isArray(content)) {
        const textContent = content
          .filter((block: any) => block.type === 'text')
          .map((block: any) => {
            // The text field may contain JSON with the actual reply
            try {
              const parsed = JSON.parse(block.text);
              return parsed.reply || block.text;
            } catch {
              return block.text;
            }
          })
          .join('');
        return textContent;
      }

      throw new Error('No response content from OpenClaw');
    } finally {
      clearTimeout(timeout);
    }
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

  async askContent(message: string): Promise<string> {
    return this.ask(message, 'agent:content:main');
  }

  disconnect() {
    // No-op: HTTP API doesn't need cleanup
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
