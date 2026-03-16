import { ChromeConnection } from "./connection.js";
export declare class TabFaviconManager {
    private readonly abortedTabs;
    startActivity(tabId: string, connection: ChromeConnection): Promise<void>;
    startActivityAfterLoad(tabId: string, connection: ChromeConnection): Promise<void>;
    markDone(tabId: string, connection: ChromeConnection): Promise<void>;
    stopActivity(tabId: string, connection: ChromeConnection): Promise<void>;
}
