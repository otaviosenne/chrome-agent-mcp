import CDP from "chrome-remote-interface";
import { randomUUID } from "crypto";
export class ExtensionBridge {
    sessionId = randomUUID().slice(0, 8);
    client = null;
    debugPort;
    tabUrls = new Map();
    constructor(debugPort) {
        this.debugPort = debugPort;
    }
    async findClient() {
        for (let attempt = 0; attempt < 3; attempt++) {
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
                        if (result?.value === true)
                            return candidate;
                        await candidate.close();
                    }
                    catch { }
                }
            }
            catch { }
            await new Promise(r => setTimeout(r, 300));
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
