export declare class TabGroupManager {
    private readonly debugPort;
    private readonly stateFile;
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
    private loadState;
    private saveState;
    private clearState;
    private restoreFromState;
    private fetchLivePageIds;
    private chromeGroupExists;
    private findExtensionClient;
    private isValidGroupName;
    private determineGroupName;
    addTab(cdpTabId: string): Promise<void>;
    private tryAddToVisualGroup;
    removeTab(tabId: string): void;
    isOwned(tabId: string): boolean;
    hasOwnedTabs(): boolean;
    getOwnedTabIds(): ReadonlySet<string>;
    getGroupName(): string;
    getGroupNumber(): number;
    renameGroup(newTitle: string): Promise<boolean>;
    setGroupColor(color: string): Promise<boolean>;
    getGroupState(): Promise<{
        name: string;
        color: string;
        id: number | null;
    }>;
}
