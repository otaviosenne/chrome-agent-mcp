import CDP from "chrome-remote-interface";
import { join } from "path";
import { nextAnimal, isAnimalName } from "../../utils/identity.js";
import { GroupStateStore, PersistedState, STATE_DIR } from "./state.js";
import { GroupChromeApi } from "./chrome-api.js";

const GROUP_COLORS = ["grey", "blue", "red", "yellow", "green", "pink", "purple", "cyan", "orange"] as const;
type GroupColor = typeof GROUP_COLORS[number];

export class TabGroupManager {
  private readonly debugPort: number;
  private readonly store: GroupStateStore;
  private readonly api: GroupChromeApi;
  private readonly ownedTabIds: Set<string> = new Set();
  private chromeGroupId: number | null = null;
  private groupName: string = "";
  private groupColor: GroupColor = GROUP_COLORS[Math.floor(Math.random() * GROUP_COLORS.length)];
  private extensionClient: any = null;
  private initPromise: Promise<void> | null = null;
  private addTabQueue: Promise<void> = Promise.resolve();

  constructor(debugPort: number) {
    this.debugPort = debugPort;
    this.store = new GroupStateStore(join(STATE_DIR, `${debugPort}-${process.pid}.json`));
    this.api = new GroupChromeApi(debugPort);
  }

  async initialize(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    GroupStateStore.cleanupDeadProcessFiles();
    this.extensionClient = await this.api.findExtensionClient();

    const saved = this.store.loadState();
    if (saved) {
      await this.restoreFromState(saved);
    } else {
      const shared = GroupStateStore.findSharedState(this.debugPort, process.pid);
      if (shared && isAnimalName(shared.groupName)) {
        this.groupName = shared.groupName;
        this.groupColor = shared.groupColor as GroupColor;
        this.chromeGroupId = shared.chromeGroupId;
      } else {
        this.restoreFromLastGroup();
      }
    }

    const cleanup = () => this.store.deleteState();
    process.once("exit", cleanup);
    process.once("SIGINT", () => { cleanup(); process.exit(0); });
    process.once("SIGTERM", () => { cleanup(); process.exit(0); });
  }

  private restoreFromLastGroup(): void {
    const last = this.store.loadLastGroup(this.debugPort);
    if (
      last &&
      isAnimalName(last.groupName) &&
      !GroupStateStore.isGroupInUse(this.debugPort, last.chromeGroupId, process.pid)
    ) {
      this.groupName = last.groupName;
      this.groupColor = last.groupColor as GroupColor;
      this.chromeGroupId = last.chromeGroupId;
    } else {
      this.assignNewGroupIdentity();
    }
  }

  private async restoreFromState(saved: PersistedState): Promise<void> {
    if (typeof saved.chromeGroupId !== "number") saved.chromeGroupId = null;

    const liveTabs = await this.fetchLivePageIds();
    const survivingIds = saved.ownedTabIds.filter(id => liveTabs.has(id));

    if (survivingIds.length === 0) {
      this.store.deleteState();
      if (isAnimalName(saved.groupName)) {
        this.groupName = saved.groupName;
        this.groupColor = saved.groupColor as GroupColor;
      } else {
        this.assignNewGroupIdentity();
      }
      return;
    }

    survivingIds.forEach(id => this.ownedTabIds.add(id));
    if (isAnimalName(saved.groupName)) {
      this.groupName = saved.groupName;
      this.groupColor = saved.groupColor as GroupColor;
    } else {
      this.assignNewGroupIdentity();
    }

    const groupStillExists = saved.chromeGroupId !== null && this.extensionClient
      ? await this.api.chromeGroupExists(saved.chromeGroupId, this.extensionClient)
      : false;

    this.chromeGroupId = groupStillExists ? saved.chromeGroupId : null;
    this.persistState();
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

  private assignNewGroupIdentity(): void {
    const animal = nextAnimal();
    this.groupName = animal.name;
    this.groupColor = animal.chromeColor as GroupColor;
  }

  private persistState(): void {
    this.store.saveState({
      chromeGroupId: this.chromeGroupId,
      groupName: this.groupName,
      groupColor: this.groupColor,
      ownedTabIds: Array.from(this.ownedTabIds),
    });
  }

  async resetForNewSession(): Promise<void> {
    if (this.chromeGroupId !== null && this.extensionClient) {
      await this.api.ungroupChromeTabs(this.chromeGroupId, this.extensionClient);
    }
    this.ownedTabIds.clear();
    this.chromeGroupId = null;
    this.initPromise = null;
    this.extensionClient = null;
    this.store.deleteState();
    this.store.deleteLastGroup(this.debugPort);
    this.assignNewGroupIdentity();
  }

  async addTab(cdpTabId: string): Promise<void> {
    await this.initialize();
    this.ownedTabIds.add(cdpTabId);
    this.addTabQueue = this.addTabQueue.then(() => this.tryAddToVisualGroup(cdpTabId));
    await this.addTabQueue;
    this.persistState();
    if (this.chromeGroupId === null) this.scheduleGroupRetry(cdpTabId);
  }

  private scheduleGroupRetry(cdpTabId: string): void {
    const delays = [1500, 3000, 5000];
    let attempt = 0;
    const retry = async () => {
      if (attempt >= delays.length || this.chromeGroupId !== null) return;
      this.extensionClient = null;
      await this.tryAddToVisualGroup(cdpTabId);
      this.persistState();
      if (this.chromeGroupId === null) setTimeout(retry, delays[attempt]);
      attempt++;
    };
    setTimeout(retry, delays[0]);
  }

  private async tryAddToVisualGroup(cdpTabId: string): Promise<void> {
    if (!this.extensionClient) {
      this.extensionClient = await this.api.findExtensionClient();
    }
    if (!this.extensionClient) return;

    const newGroupId = await this.api.tryAddToVisualGroup(
      cdpTabId,
      this.ownedTabIds,
      this.chromeGroupId,
      this.groupName,
      this.groupColor,
      this.extensionClient
    );

    if (newGroupId !== null) {
      this.chromeGroupId = newGroupId;
      this.persistState();
    } else {
      this.extensionClient = null;
    }
  }

  removeTab(tabId: string): void {
    this.ownedTabIds.delete(tabId);
    if (this.ownedTabIds.size === 0) {
      this.store.deleteState();
    } else {
      this.persistState();
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

  getGroupNumber(): number {
    const match = this.groupName.match(/#(\d+)/);
    return match ? parseInt(match[1], 10) : 1;
  }

  getGroupColor(): string {
    return this.groupColor;
  }

  async renameGroup(newTitle: string): Promise<boolean> {
    await this.initialize();
    this.groupName = newTitle;
    this.persistState();
    if (!this.extensionClient) {
      this.extensionClient = await this.api.findExtensionClient();
    }
    if (!this.extensionClient || this.chromeGroupId === null) return false;
    try {
      await this.extensionClient.Runtime.evaluate({
        expression: `chrome.tabGroups.update(${this.chromeGroupId}, { title: ${JSON.stringify(newTitle)} })`,
        returnByValue: true,
        awaitPromise: true,
      });
      return true;
    } catch {
      this.extensionClient = null;
      return false;
    }
  }

  async setGroupColor(color: string): Promise<boolean> {
    await this.initialize();
    const validColors = GROUP_COLORS as readonly string[];
    if (!validColors.includes(color)) return false;
    this.groupColor = color as GroupColor;
    this.persistState();
    if (!this.extensionClient) {
      this.extensionClient = await this.api.findExtensionClient();
    }
    if (!this.extensionClient || this.chromeGroupId === null) return false;
    try {
      await this.extensionClient.Runtime.evaluate({
        expression: `chrome.tabGroups.update(${this.chromeGroupId}, { color: ${JSON.stringify(color)} })`,
        returnByValue: true,
        awaitPromise: true,
      });
      return true;
    } catch {
      this.extensionClient = null;
      return false;
    }
  }

  async getGroupState(): Promise<{ name: string; color: string; id: number | null }> {
    await this.initialize();
    if (this.extensionClient && this.chromeGroupId !== null) {
      try {
        const { result } = await this.extensionClient.Runtime.evaluate({
          expression: `(async () => { const g = await chrome.tabGroups.get(${this.chromeGroupId}); return JSON.stringify({ name: g.title ?? '', color: g.color }); })()`,
          returnByValue: true,
          awaitPromise: true,
        });
        if (result?.value) {
          const parsed = JSON.parse(result.value) as { name: string; color: string };
          return { name: parsed.name, color: parsed.color, id: this.chromeGroupId };
        }
      } catch {
        this.extensionClient = null;
      }
    }
    return { name: this.groupName, color: this.groupColor, id: this.chromeGroupId };
  }
}
