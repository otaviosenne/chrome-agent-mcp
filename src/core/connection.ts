import CDP from "chrome-remote-interface";
import { TabInfo, NetworkRequest, ConsoleEntry } from "../types.js";
import { TabGroupManager } from "./groups/manager.js";

const MAX_LOG_ENTRIES = 500;

interface MousePosition {
  x: number;
  y: number;
}

export class ChromeConnection {
  private readonly debugPort: number;
  private readonly clients: Map<string, any> = new Map();
  private activeTabId: string | null = null;
  private readonly networkLogs: Map<string, NetworkRequest[]> = new Map();
  private readonly consoleLogs: Map<string, ConsoleEntry[]> = new Map();
  private readonly networkEnabled: Set<string> = new Set();
  private readonly consoleEnabled: Set<string> = new Set();
  private readonly mousePositions: Map<string, MousePosition> = new Map();
  readonly tabGroup: TabGroupManager;

  constructor(debugPort = 9222) {
    this.debugPort = debugPort;
    this.tabGroup = new TabGroupManager(debugPort);
  }

  async listTabs(): Promise<TabInfo[]> {
    const targets = await (CDP as any).List({ port: this.debugPort });
    return targets
      .filter((t: any) => t.type === "page" && this.tabGroup.isOwned(t.id))
      .map((t: any) => ({
        id: t.id,
        title: t.title,
        url: t.url,
        type: t.type,
        webSocketDebuggerUrl: t.webSocketDebuggerUrl,
      }));
  }

  async getClient(tabId?: string): Promise<any> {
    const resolvedId = tabId ?? this.activeTabId;
    if (!resolvedId) {
      const ownedIds = Array.from(this.tabGroup.getOwnedTabIds());
      if (ownedIds.length > 0) {
        this.activeTabId = ownedIds[0];
        return this.getClientForTab(this.activeTabId);
      }
      const newTab = await this.newTab();
      return this.getClientForTab(newTab.id);
    }
    if (tabId) this.activeTabId = tabId;
    return this.getClientForTab(resolvedId);
  }

  async getClientForTab(tabId: string): Promise<any> {
    if (this.clients.has(tabId)) {
      const existing = this.clients.get(tabId)!;
      try {
        await existing.Runtime.evaluate({ expression: "1" });
        return existing;
      } catch {
        this.clients.delete(tabId);
      }
    }

    const client = await (CDP as any)({ target: tabId, port: this.debugPort });
    await Promise.all([
      client.Page.enable(),
      client.DOM.enable(),
      client.Runtime.enable(),
      client.Accessibility.enable(),
    ]);

    client.on("disconnect", () => {
      this.clients.delete(tabId);
      this.networkEnabled.delete(tabId);
      this.consoleEnabled.delete(tabId);
      if (this.activeTabId === tabId) this.activeTabId = null;
    });

    this.clients.set(tabId, client);
    return client;
  }

  clearClientForTab(tabId: string): void {
    const client = this.clients.get(tabId);
    if (client) {
      try { client.close(); } catch {}
      this.clients.delete(tabId);
    }
  }

  setActiveTab(tabId: string): void {
    this.activeTabId = tabId;
  }

  getActiveTabId(): string | null {
    return this.activeTabId;
  }

  async newTab(url?: string): Promise<TabInfo> {
    const target = await (CDP as any).New({
      port: this.debugPort,
      url: url || "about:blank",
    });
    this.activeTabId = target.id;
    const tab: TabInfo = {
      id: target.id,
      title: target.title || "",
      url: target.url || url || "about:blank",
      type: target.type,
      webSocketDebuggerUrl: target.webSocketDebuggerUrl || "",
    };
    await this.tabGroup.addTab(tab.id);
    return tab;
  }

  async closeTab(tabId: string): Promise<void> {
    const client = this.clients.get(tabId);
    if (client) {
      try { await client.close(); } catch {}
      this.clients.delete(tabId);
    }
    await (CDP as any).Close({ id: tabId, port: this.debugPort });
    this.tabGroup.removeTab(tabId);
    this.networkLogs.delete(tabId);
    this.consoleLogs.delete(tabId);
    this.networkEnabled.delete(tabId);
    this.consoleEnabled.delete(tabId);
    this.mousePositions.delete(tabId);
    if (this.activeTabId === tabId) this.activeTabId = null;
  }

  async enableNetworkMonitoring(tabId: string): Promise<void> {
    if (this.networkEnabled.has(tabId)) return;

    const client = await this.getClientForTab(tabId);
    await client.Network.enable();

    if (!this.networkLogs.has(tabId)) this.networkLogs.set(tabId, []);

    const pendingRequests = new Map<string, { startTime: number; method: string; url: string; resourceType: string; requestHeaders: any }>();

    client.Network.requestWillBeSent((params: any) => {
      pendingRequests.set(params.requestId, {
        startTime: params.timestamp,
        method: params.request.method,
        url: params.request.url,
        resourceType: params.type || "Other",
        requestHeaders: params.request.headers,
      });
    });

    client.Network.responseReceived((params: any) => {
      const pending = pendingRequests.get(params.requestId);
      if (!pending) return;

      const logs = this.networkLogs.get(tabId)!;
      logs.push({
        requestId: params.requestId,
        method: pending.method,
        url: pending.url,
        resourceType: pending.resourceType,
        status: params.response.status,
        statusText: params.response.statusText,
        requestHeaders: pending.requestHeaders,
        responseHeaders: params.response.headers,
        startTime: pending.startTime,
        duration: params.timestamp - pending.startTime,
      });

      pendingRequests.delete(params.requestId);
      if (logs.length > MAX_LOG_ENTRIES) logs.shift();
    });

    client.Network.loadingFailed((params: any) => {
      pendingRequests.delete(params.requestId);
    });

    this.networkEnabled.add(tabId);
  }

  async enableConsoleMonitoring(tabId: string): Promise<void> {
    if (this.consoleEnabled.has(tabId)) return;

    const client = await this.getClientForTab(tabId);
    await client.Log.enable();

    if (!this.consoleLogs.has(tabId)) this.consoleLogs.set(tabId, []);

    client.Runtime.consoleAPICalled((params: any) => {
      const logs = this.consoleLogs.get(tabId)!;
      const text =
        params.args
          ?.map((a: any) => a.value ?? a.description ?? String(a))
          .join(" ") ?? "";
      logs.push({ level: params.type, text, timestamp: params.timestamp });
      if (logs.length > MAX_LOG_ENTRIES) logs.shift();
    });

    client.Log.entryAdded((params: any) => {
      const logs = this.consoleLogs.get(tabId)!;
      logs.push({
        level: params.entry.level,
        text: params.entry.text,
        url: params.entry.url,
        line: params.entry.lineNumber,
        timestamp: Date.now(),
      });
      if (logs.length > MAX_LOG_ENTRIES) logs.shift();
    });

    this.consoleEnabled.add(tabId);
  }

  getNetworkLog(tabId: string): NetworkRequest[] {
    return this.networkLogs.get(tabId) ?? [];
  }

  getConsoleLog(tabId: string): ConsoleEntry[] {
    return this.consoleLogs.get(tabId) ?? [];
  }

  clearNetworkLog(tabId: string): void {
    this.networkLogs.set(tabId, []);
  }

  clearConsoleLog(tabId: string): void {
    this.consoleLogs.set(tabId, []);
  }

  getMousePosition(tabId: string): MousePosition {
    return this.mousePositions.get(tabId) ?? { x: 0, y: 0 };
  }

  setMousePosition(tabId: string, x: number, y: number): void {
    this.mousePositions.set(tabId, { x, y });
  }

  async smoothMouseMove(client: any, tabId: string, toX: number, toY: number, steps = 25): Promise<void> {
    const from = this.getMousePosition(tabId);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      const x = from.x + (toX - from.x) * ease;
      const y = from.y + (toY - from.y) * ease;
      await client.Input.dispatchMouseEvent({ type: "mouseMoved", x, y });
      await new Promise((r) => setTimeout(r, 8));
    }
    this.setMousePosition(tabId, toX, toY);
  }
}
