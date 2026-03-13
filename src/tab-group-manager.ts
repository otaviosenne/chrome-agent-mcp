import CDP from "chrome-remote-interface";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const GROUP_COLORS = ["grey", "blue", "red", "yellow", "green", "pink", "purple", "cyan"] as const;
type GroupColor = typeof GROUP_COLORS[number];

const STATE_DIR = join(homedir(), ".local", "share", "chrome-agent-mcp");

interface PersistedState {
  chromeGroupId: number | null;
  groupName: string;
  groupColor: GroupColor;
  ownedTabIds: string[];
}

export class TabGroupManager {
  private readonly debugPort: number;
  private readonly stateFile: string;
  private readonly ownedTabIds: Set<string> = new Set();
  private chromeGroupId: number | null = null;
  private groupName: string = "CLAUDE #1";
  private groupColor: GroupColor = GROUP_COLORS[Math.floor(Math.random() * GROUP_COLORS.length)];
  private extensionClient: any = null;
  private initPromise: Promise<void> | null = null;
  private addTabQueue: Promise<void> = Promise.resolve();

  constructor(debugPort: number) {
    this.debugPort = debugPort;
    this.stateFile = join(STATE_DIR, `${debugPort}-${process.pid}.json`);
  }

  async initialize(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    this.extensionClient = await this.findExtensionClient();

    const saved = this.loadState();
    if (saved) {
      await this.restoreFromState(saved);
    } else if (this.extensionClient) {
      this.groupName = await this.determineGroupName();
    }
  }

  private loadState(): PersistedState | null {
    try {
      if (!existsSync(this.stateFile)) return null;
      return JSON.parse(readFileSync(this.stateFile, "utf8")) as PersistedState;
    } catch {
      return null;
    }
  }

  private saveState(): void {
    try {
      mkdirSync(STATE_DIR, { recursive: true });
      const state: PersistedState = {
        chromeGroupId: this.chromeGroupId,
        groupName: this.groupName,
        groupColor: this.groupColor,
        ownedTabIds: Array.from(this.ownedTabIds),
      };
      writeFileSync(this.stateFile, JSON.stringify(state, null, 2));
    } catch {}
  }

  private clearState(): void {
    try {
      if (existsSync(this.stateFile)) {
        writeFileSync(this.stateFile, JSON.stringify({ chromeGroupId: null, groupName: this.groupName, groupColor: this.groupColor, ownedTabIds: [] }, null, 2));
      }
    } catch {}
  }

  private async restoreFromState(saved: PersistedState): Promise<void> {
    this.groupColor = saved.groupColor;
    if (typeof saved.chromeGroupId !== "number") saved.chromeGroupId = null;

    const liveTabs = await this.fetchLivePageIds();
    const survivingIds = saved.ownedTabIds.filter(id => liveTabs.has(id));

    if (survivingIds.length === 0) {
      this.groupName = this.extensionClient
        ? await this.determineGroupName()
        : saved.groupName;
      return;
    }

    survivingIds.forEach(id => this.ownedTabIds.add(id));
    this.groupName = saved.groupName;

    const groupStillExists = saved.chromeGroupId !== null && this.extensionClient
      ? await this.chromeGroupExists(saved.chromeGroupId)
      : false;

    this.chromeGroupId = groupStillExists ? saved.chromeGroupId : null;
    this.saveState();
  }

  private async fetchLivePageIds(): Promise<Set<string>> {
    try {
      const targets = await (CDP as any).List({ port: this.debugPort });
      return new Set(
        targets.filter((t: any) => t.type === "page").map((t: any) => t.id)
      );
    } catch {
      return new Set();
    }
  }

  private async chromeGroupExists(groupId: number): Promise<boolean> {
    try {
      const { result } = await this.extensionClient.Runtime.evaluate({
        expression: `(async () => { try { await chrome.tabGroups.get(${groupId}); return true; } catch { return false; } })()`,
        returnByValue: true,
        awaitPromise: true,
      });
      return result?.value === true;
    } catch {
      return false;
    }
  }

  private async findExtensionClient(): Promise<any | null> {
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        const targets = await (CDP as any).List({ port: this.debugPort });
        const extensionTargets = targets.filter(
          (t: any) => t.type === "service_worker" || t.type === "background_page"
        );

        for (const target of extensionTargets) {
          try {
            const client = await (CDP as any)({ target: target.id, port: this.debugPort });
            await client.Runtime.enable();
            const { result } = await client.Runtime.evaluate({
              expression: "typeof chrome !== 'undefined' && typeof chrome.tabGroups !== 'undefined'",
              returnByValue: true,
            });
            if (result?.value === true) return client;
            await client.close();
          } catch {}
        }
      } catch {}

      await new Promise((r) => setTimeout(r, 500));
    }
    return null;
  }

  private async determineGroupName(): Promise<string> {
    try {
      const { result } = await this.extensionClient.Runtime.evaluate({
        expression: `
          (async () => {
            const groups = await chrome.tabGroups.query({});
            const nums = groups
              .filter(g => g.title?.startsWith('CLAUDE #'))
              .map(g => parseInt(g.title.replace('CLAUDE #', ''), 10))
              .filter(n => !isNaN(n));
            let n = 1; while (nums.includes(n)) n++; return n;
          })()
        `,
        returnByValue: true,
        awaitPromise: true,
      });
      return `CLAUDE #${result?.value ?? 1}`;
    } catch {
      return "CLAUDE #1";
    }
  }

  async addTab(cdpTabId: string): Promise<void> {
    await this.initialize();
    this.ownedTabIds.add(cdpTabId);
    this.addTabQueue = this.addTabQueue.then(() => this.tryAddToVisualGroup(cdpTabId));
    await this.addTabQueue;
    this.saveState();
  }

  private async tryAddToVisualGroup(cdpTabId: string): Promise<void> {
    if (!this.extensionClient) {
      this.extensionClient = await this.findExtensionClient();
    }
    if (!this.extensionClient) return;

    try {
      await new Promise((r) => setTimeout(r, 300));

      const { result: tabsResult } = await this.extensionClient.Runtime.evaluate({
        expression: `
          (async () => {
            const tabs = await chrome.tabs.query({});
            const sorted = tabs.sort((a, b) => b.id - a.id);
            return JSON.stringify(sorted.map(t => ({ id: t.id, url: t.url, pendingUrl: t.pendingUrl })));
          })()
        `,
        returnByValue: true,
        awaitPromise: true,
      });

      const chromeTabs: Array<{ id: number; url: string; pendingUrl?: string }> =
        JSON.parse(tabsResult?.value ?? "[]");

      if (chromeTabs.length === 0) return;

      const targets = await (CDP as any).List({ port: this.debugPort });
      const target = targets.find((t: any) => t.id === cdpTabId);

      const normalize = (u: string) => (u ?? "").replace(/\/$/, "");
      const targetUrl = target ? normalize(target.url) : "";

      const match =
        chromeTabs.find(
          (t) =>
            normalize(t.url) === targetUrl ||
            normalize(t.pendingUrl ?? "") === targetUrl
        ) ?? chromeTabs[0];

      if (!match) return;

      const expression = this.chromeGroupId !== null
        ? `chrome.tabs.group({ groupId: ${this.chromeGroupId}, tabIds: [${match.id}] })`
        : `(async () => {
            const existing = await chrome.tabGroups.query({ title: ${JSON.stringify(this.groupName)} });
            const existingId = existing[0]?.id ?? null;
            const gid = await chrome.tabs.group(
              existingId ? { groupId: existingId, tabIds: [${match.id}] } : { tabIds: [${match.id}] }
            );
            if (!existingId) {
              await chrome.tabGroups.update(gid, {
                title: ${JSON.stringify(this.groupName)},
                color: ${JSON.stringify(this.groupColor)}
              });
            }
            return gid;
          })()`;

      const { result } = await this.extensionClient.Runtime.evaluate({
        expression,
        returnByValue: true,
        awaitPromise: true,
      });

      if (typeof result?.value === "number") {
        this.chromeGroupId = result.value;
        this.saveState();
      }
    } catch {
      this.extensionClient = null;
    }
  }

  removeTab(tabId: string): void {
    this.ownedTabIds.delete(tabId);
    if (this.ownedTabIds.size === 0) {
      this.clearState();
    } else {
      this.saveState();
    }
  }

  isOwned(tabId: string): boolean {
    return this.ownedTabIds.has(tabId);
  }

  hasOwnedTabs(): boolean {
    return this.ownedTabIds.size > 0;
  }

  getOwnedTabIds(): ReadonlySet<string> {
    return this.ownedTabIds;
  }

  getGroupName(): string {
    return this.groupName;
  }
}
