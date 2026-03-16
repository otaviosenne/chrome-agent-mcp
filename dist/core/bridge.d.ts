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
export declare class ExtensionBridge {
    readonly sessionId: string;
    private client;
    private readonly debugPort;
    private readonly tabUrls;
    private onConnected?;
    constructor(debugPort: number);
    setOnConnected(cb: () => void): void;
    private startReconnectLoop;
    private findClient;
    private getClient;
    log(partial: Omit<BridgeEvent, "sessionId" | "timestamp">): Promise<void>;
}
