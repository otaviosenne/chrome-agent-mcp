import CDP from "chrome-remote-interface";
import { randomUUID } from "crypto";

export interface BridgeEvent {
  type: string;
  tool: string;
  tabId?: string;
  tabUrl?: string;
  groupName: string;
  sessionId: string;
  timestamp: number;
  screenshot?: string;
  description?: string;
  tabVerb?: string;
}

const RECONNECT_INTERVAL_MS = 5000;
const FIND_ATTEMPTS = 6;
const FIND_DELAY_MS = 500;

export class ExtensionBridge {
  readonly sessionId: string = randomUUID().slice(0, 8);
  private client: any = null;
  private readonly debugPort: number;
  private readonly tabUrls = new Map<string, string>();

  constructor(debugPort: number) {
    this.debugPort = debugPort;
    this.startReconnectLoop();
  }

  private startReconnectLoop(): void {
    setInterval(async () => {
      if (!this.client) {
        this.client = await this.findClient();
      }
    }, RECONNECT_INTERVAL_MS);
  }

  private async findClient(): Promise<any | null> {
    for (let attempt = 0; attempt < FIND_ATTEMPTS; attempt++) {
      try {
        const targets = await (CDP as any).List({ port: this.debugPort });
        const extensionTargets = targets.filter(
          (t: any) => t.type === "service_worker" || t.type === "background_page"
        );

        for (const target of extensionTargets) {
          try {
            const candidate = await (CDP as any)({ target: target.id, port: this.debugPort });
            await candidate.Runtime.enable();
            const { result } = await candidate.Runtime.evaluate({
              expression: "typeof self.__mcpLogEvent === 'function'",
              returnByValue: true,
            });
            if (result?.value === true) {
              candidate.on("disconnect", () => { this.client = null; });
              return candidate;
            }
            await candidate.close();
          } catch {}
        }
      } catch {}

      await new Promise<void>(r => setTimeout(r, FIND_DELAY_MS));
    }
    return null;
  }

  private async getClient(): Promise<any | null> {
    if (!this.client) this.client = await this.findClient();
    return this.client;
  }

  async log(partial: Omit<BridgeEvent, "sessionId" | "timestamp">): Promise<void> {
    try {
      const client = await this.getClient();
      if (!client) return;
      if (partial.tabId && partial.tabUrl) this.tabUrls.set(partial.tabId, partial.tabUrl);
      const event: BridgeEvent = {
        ...partial,
        tabUrl: partial.tabUrl ?? (partial.tabId ? this.tabUrls.get(partial.tabId) : undefined),
        sessionId: this.sessionId,
        timestamp: Date.now(),
      };
      await client.Runtime.evaluate({
        expression: `self.__mcpLogEvent && self.__mcpLogEvent(${JSON.stringify(JSON.stringify(event))})`,
      });
    } catch {
      this.client = null;
    }
  }
}
