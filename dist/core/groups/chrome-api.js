import CDP from "chrome-remote-interface";
const FIND_ATTEMPTS = 6;
const FIND_DELAY_MS = 500;
export class GroupChromeApi {
    debugPort;
    constructor(debugPort) {
        this.debugPort = debugPort;
    }
    async findExtensionClient() {
        for (let attempt = 0; attempt < FIND_ATTEMPTS; attempt++) {
            try {
                const targets = await CDP.List({ port: this.debugPort });
                const extensionTargets = targets.filter((t) => t.type === "service_worker" || t.type === "background_page");
                for (const target of extensionTargets) {
                    try {
                        const client = await CDP({ target: target.id, port: this.debugPort });
                        await client.Runtime.enable();
                        const { result } = await client.Runtime.evaluate({
                            expression: "typeof self.__mcpLogEvent === 'function' && typeof chrome.tabGroups !== 'undefined'",
                            returnByValue: true,
                        });
                        if (result?.value === true)
                            return client;
                        await client.close();
                    }
                    catch { }
                }
            }
            catch { }
            await new Promise((r) => setTimeout(r, FIND_DELAY_MS));
        }
        return null;
    }
    async ungroupChromeTabs(chromeGroupId, extensionClient) {
        try {
            await extensionClient.Runtime.evaluate({
                expression: `(async () => {
          const tabs = await chrome.tabs.query({ groupId: ${chromeGroupId} });
          if (tabs.length > 0) await chrome.tabs.ungroup(tabs.map(t => t.id));
        })()`,
                returnByValue: true,
                awaitPromise: true,
            });
        }
        catch { }
    }
    async chromeGroupExists(groupId, client) {
        try {
            const { result } = await client.Runtime.evaluate({
                expression: `(async () => { try { await chrome.tabGroups.get(${groupId}); return true; } catch { return false; } })()`,
                returnByValue: true,
                awaitPromise: true,
            });
            return result?.value === true;
        }
        catch {
            return false;
        }
    }
    async tryAddToVisualGroup(cdpTabId, ownedIds, groupId, groupName, groupColor, extensionClient) {
        try {
            await new Promise((r) => setTimeout(r, 300));
            const { result: tabsResult } = await extensionClient.Runtime.evaluate({
                expression: `
          (async () => {
            const tabs = await chrome.tabs.query({});
            const sorted = tabs.sort((a, b) => b.id - a.id);
            return JSON.stringify(sorted.map(t => ({ id: t.id, url: t.url, pendingUrl: t.pendingUrl, groupId: t.groupId })));
          })()
        `,
                returnByValue: true,
                awaitPromise: true,
            });
            const chromeTabs = JSON.parse(tabsResult?.value ?? "[]");
            if (chromeTabs.length === 0)
                return null;
            const targets = await CDP.List({ port: this.debugPort });
            const target = targets.find((t) => t.id === cdpTabId);
            const normalize = (u) => (u ?? "").replace(/\/$/, "");
            const targetUrl = target ? normalize(target.url) : "";
            const UNGROUPED = -1;
            const isAmbiguousUrl = targetUrl === "" || targetUrl === "about:blank";
            const candidates = chromeTabs.filter((t) => t.groupId === UNGROUPED || t.groupId === groupId);
            const urlMatch = isAmbiguousUrl
                ? undefined
                : candidates.find((t) => normalize(t.url) === targetUrl ||
                    normalize(t.pendingUrl ?? "") === targetUrl);
            const ungroupedFallback = candidates.find((t) => t.groupId === UNGROUPED);
            const match = urlMatch ?? ungroupedFallback;
            if (!match)
                return null;
            const expression = `(async () => {
            ${groupId !== null ? `try {
              const gid = await chrome.tabs.group({ groupId: ${groupId}, tabIds: [${match.id}] });
              await chrome.tabGroups.update(gid, { title: ${JSON.stringify(groupName)}, color: ${JSON.stringify(groupColor)} });
              return gid;
            } catch {}` : ""}
            const existing = await chrome.tabGroups.query({ title: ${JSON.stringify(groupName)} });
            const existingId = existing[0]?.id ?? null;
            const gid = await chrome.tabs.group(
              existingId ? { groupId: existingId, tabIds: [${match.id}] } : { tabIds: [${match.id}] }
            );
            await chrome.tabGroups.update(gid, {
              title: ${JSON.stringify(groupName)},
              color: ${JSON.stringify(groupColor)}
            });
            return gid;
          })()`;
            const { result } = await extensionClient.Runtime.evaluate({
                expression,
                returnByValue: true,
                awaitPromise: true,
            });
            return typeof result?.value === "number" ? result.value : null;
        }
        catch {
            return null;
        }
    }
}
