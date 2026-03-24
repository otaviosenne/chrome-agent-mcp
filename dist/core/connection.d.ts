import { TabInfo, NetworkRequest, ConsoleEntry } from "../types.js";
import { TabGroupManager } from "./groups/manager.js";
interface MousePosition {
    x: number;
    y: number;
}
export declare class ChromeConnection {
    private readonly debugPort;
    private readonly clients;
    private activeTabId;
    private readonly networkLogs;
    private readonly consoleLogs;
    private readonly networkEnabled;
    private readonly consoleEnabled;
    private readonly mousePositions;
    readonly tabGroup: TabGroupManager;
    constructor(debugPort?: number);
    listTabs(): Promise<TabInfo[]>;
    getClient(tabId?: string): Promise<any>;
    getClientForTab(tabId: string): Promise<any>;
    clearClientForTab(tabId: string): void;
    setActiveTab(tabId: string): void;
    getActiveTabId(): string | null;
    newTab(url?: string): Promise<TabInfo>;
    closeTab(tabId: string): Promise<void>;
    enableNetworkMonitoring(tabId: string): Promise<void>;
    enableConsoleMonitoring(tabId: string): Promise<void>;
    getNetworkLog(tabId: string): NetworkRequest[];
    getConsoleLog(tabId: string): ConsoleEntry[];
    clearNetworkLog(tabId: string): void;
    clearConsoleLog(tabId: string): void;
    getMousePosition(tabId: string): MousePosition;
    setMousePosition(tabId: string, x: number, y: number): void;
    smoothMouseMove(client: any, tabId: string, toX: number, toY: number, steps?: number): Promise<void>;
    showCursorClickRipple(client: any, x: number, y: number): Promise<void>;
    showCursorScrollPulse(client: any, direction: string): Promise<void>;
    private runPhantomCursorAnimation;
}
export {};
