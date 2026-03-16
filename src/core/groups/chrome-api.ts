import CDP from "chrome-remote-interface";

const FIND_ATTEMPTS = 6;
const FIND_DELAY_MS = 500;

export class GroupChromeApi {
  private readonly debugPort: number;

  constructor(debugPort: number) {
    this.debugPort = debugPort;
  }

  async findExtensionClient(): Promise<any | null> {
    for (let attempt = 0; attempt < FIND_ATTEMPTS; attempt++) {
      try {
        const targets = await (CDP as any).List({ port: this.debugPort });
        const extensionTargets = targets.filter(
          (t: any) => t.type === "service_worker" || t.type === "background_page"
        );

        for (const target of extensionTargets) {
          try {
            const client = await (CDP as any)({ target: target.id, port: this.debugPort });
            await client.Runtime.enable();
            const { result } = await client.Runtime.evaluate({
              expression: "typeof self.__mcpLogEvent === 'function' && typeof chrome.tabGroups !== 'undefined'",
              returnByValue: true,
            });
            if (result?.value === true) return client;
            await client.close();
          } catch {}
        }
      } catch {}

      await new Promise((r) => setTimeout(r, FIND_DELAY_MS));
    }
    return null;
  }

  async chromeGroupExists(groupId: number, client: any): Promise<boolean> {
    try {
      const { result } = await client.Runtime.evaluate({
        expression: `(async () => { try { await chrome.tabGroups.get(${groupId}); return true; } catch { return false; } })()`,
        returnByValue: true,
        awaitPromise: true,
      });
      return result?.value === true;
    } catch {
      return false;
    }
  }

  async tryAddToVisualGroup(
    cdpTabId: string,
    ownedIds: ReadonlySet<string>,
    groupId: number | null,
    groupName: string,
    groupColor: string,
    extensionClient: any
  ): Promise<number | null> {
    try {
      await new Promise((r) => setTimeout(r, 300));

      const { result: tabsResult } = await extensionClient.Runtime.evaluate({
        expression: `
          (async () => {
            const tabs = await chrome.tabs.query({});
            const sorted = tabs.sort((a, b) => b.id - a.id);
            return JSON.stringify(sorted.map(t => ({ id: t.id, url: t.url, pendingUrl: t.pendingUrl })));
          })()
        `,
        returnByValue: true,
        awaitPromise: true,
      });

      const chromeTabs: Array<{ id: number; url: string; pendingUrl?: string }> =
        JSON.parse(tabsResult?.value ?? "[]");

      if (chromeTabs.length === 0) return null;

      const targets = await (CDP as any).List({ port: this.debugPort });
      const target = targets.find((t: any) => t.id === cdpTabId);

      const normalize = (u: string) => (u ?? "").replace(/\/$/, "");
      const targetUrl = target ? normalize(target.url) : "";

      const match =
        chromeTabs.find(
          (t) =>
            normalize(t.url) === targetUrl ||
            normalize(t.pendingUrl ?? "") === targetUrl
        ) ?? chromeTabs[0];

      if (!match) return null;

      const expression = `(async () => {
            ${groupId !== null ? `try {
              return await chrome.tabs.group({ groupId: ${groupId}, tabIds: [${match.id}] });
            } catch {}` : ""}
            const existing = await chrome.tabGroups.query({ title: ${JSON.stringify(groupName)} });
            const existingId = existing[0]?.id ?? null;
            const gid = await chrome.tabs.group(
              existingId ? { groupId: existingId, tabIds: [${match.id}] } : { tabIds: [${match.id}] }
            );
            if (!existingId) {
              await chrome.tabGroups.update(gid, {
                title: ${JSON.stringify(groupName)},
                color: ${JSON.stringify(groupColor)}
              });
            }
            return gid;
          })()`;

      const { result } = await extensionClient.Runtime.evaluate({
        expression,
        returnByValue: true,
        awaitPromise: true,
      });

      return typeof result?.value === "number" ? result.value : null;
    } catch {
      return null;
    }
  }
}
