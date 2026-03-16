import CDP from "chrome-remote-interface";
import { randomUUID } from "crypto";
const RECONNECT_INTERVAL_MS = 5000;
const FIND_ATTEMPTS = 6;
const FIND_DELAY_MS = 500;
export class ExtensionBridge {
    sessionId = randomUUID().slice(0, 8);
    client = null;
    debugPort;
    tabUrls = new Map();
    onConnected;
    constructor(debugPort) {
        this.debugPort = debugPort;
        this.startReconnectLoop();
    }
    setOnConnected(cb) {
        this.onConnected = cb;
    }
    startReconnectLoop() {
        setInterval(async () => {
            if (!this.client) {
                this.client = await this.findClient();
                if (this.client)
                    this.onConnected?.();
            }
        }, RECONNECT_INTERVAL_MS);
    }
    async findClient() {
        for (let attempt = 0; attempt < FIND_ATTEMPTS; attempt++) {
            try {
                const targets = await CDP.List({ port: this.debugPort });
                const extensionTargets = targets.filter((t) => t.type === "service_worker" || t.type === "background_page");
                for (const target of extensionTargets) {
                    try {
                        const candidate = await CDP({ target: target.id, port: this.debugPort });
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
                    }
                    catch { }
                }
            }
            catch { }
            await new Promise(r => setTimeout(r, FIND_DELAY_MS));
        }
        return null;
    }
    async getClient() {
        if (!this.client)
            this.client = await this.findClient();
        return this.client;
    }
    async log(partial) {
        try {
            const client = await this.getClient();
            if (!client)
                return;
            if (partial.tabId && partial.tabUrl)
                this.tabUrls.set(partial.tabId, partial.tabUrl);
            const event = {
                ...partial,
                tabUrl: partial.tabUrl ?? (partial.tabId ? this.tabUrls.get(partial.tabId) : undefined),
                sessionId: this.sessionId,
                timestamp: Date.now(),
            };
            await client.Runtime.evaluate({
                expression: `self.__mcpLogEvent && self.__mcpLogEvent(${JSON.stringify(JSON.stringify(event))})`,
            });
        }
        catch {
            this.client = null;
        }
    }
}
