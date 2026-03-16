export declare class TabGroupManager {
    private readonly debugPort;
    private readonly store;
    private readonly api;
    private readonly ownedTabIds;
    private chromeGroupId;
    private groupName;
    private groupColor;
    private extensionClient;
    private initPromise;
    private addTabQueue;
    constructor(debugPort: number);
    initialize(): Promise<void>;
    private doInitialize;
    private restoreFromState;
    private fetchLivePageIds;
    private assignNewGroupIdentity;
    private persistState;
    resetForNewSession(): void;
    addTab(cdpTabId: string): Promise<void>;
    private scheduleGroupRetry;
    private tryAddToVisualGroup;
    removeTab(tabId: string): void;
    isOwned(tabId: string): boolean;
    hasOwnedTabs(): boolean;
    getOwnedTabIds(): ReadonlySet<string>;
    getGroupName(): string;
    getGroupNumber(): number;
    getGroupColor(): string;
    renameGroup(newTitle: string): Promise<boolean>;
    setGroupColor(color: string): Promise<boolean>;
    getGroupState(): Promise<{
        name: string;
        color: string;
        id: number | null;
    }>;
}
