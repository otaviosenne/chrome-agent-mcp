export declare class GroupChromeApi {
    private readonly debugPort;
    constructor(debugPort: number);
    findExtensionClient(): Promise<any | null>;
    chromeGroupExists(groupId: number, client: any): Promise<boolean>;
    tryAddToVisualGroup(cdpTabId: string, ownedIds: ReadonlySet<string>, groupId: number | null, groupName: string, groupColor: string, extensionClient: any): Promise<number | null>;
}
