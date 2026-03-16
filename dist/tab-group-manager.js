import CDP from "chrome-remote-interface";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { nextAnimal, isAnimalName } from "./animal-sequence.js";
const GROUP_COLORS = ["grey", "blue", "red", "yellow", "green", "pink", "purple", "cyan", "orange"];
const STATE_DIR = join(homedir(), ".local", "share", "chrome-agent-mcp");
export class TabGroupManager {
    debugPort;
    stateFile;
    ownedTabIds = new Set();
    chromeGroupId = null;
    groupName = "";
    groupColor = GROUP_COLORS[Math.floor(Math.random() * GROUP_COLORS.length)];
    extensionClient = null;
    initPromise = null;
    addTabQueue = Promise.resolve();
    constructor(debugPort) {
        this.debugPort = debugPort;
        this.stateFile = join(STATE_DIR, `${debugPort}-${process.pid}.json`);
    }
    async initialize() {
        if (this.initPromise)
            return this.initPromise;
        this.initPromise = this.doInitialize();
        return this.initPromise;
    }
    async doInitialize() {
        this.extensionClient = await this.findExtensionClient();
        const saved = this.loadState();
        if (saved) {
            await this.restoreFromState(saved);
        }
        else {
            await this.discoverExistingGroup();
        }
    }
    async discoverExistingGroup() {
        this.assignNewGroupIdentity();
    }
    loadState() {
        try {
            if (!existsSync(this.stateFile))
                return null;
            return JSON.parse(readFileSync(this.stateFile, "utf8"));
        }
        catch {
            return null;
        }
    }
    saveState() {
        try {
            mkdirSync(STATE_DIR, { recursive: true });
            const state = {
                chromeGroupId: this.chromeGroupId,
                groupName: this.groupName,
                groupColor: this.groupColor,
                ownedTabIds: Array.from(this.ownedTabIds),
            };
            writeFileSync(this.stateFile, JSON.stringify(state, null, 2));
        }
        catch { }
    }
    clearState() {
        try {
            if (existsSync(this.stateFile)) {
                writeFileSync(this.stateFile, JSON.stringify({ chromeGroupId: null, groupName: this.groupName, groupColor: this.groupColor, ownedTabIds: [] }, null, 2));
            }
        }
        catch { }
    }
    async restoreFromState(saved) {
        if (typeof saved.chromeGroupId !== "number")
            saved.chromeGroupId = null;
        const liveTabs = await this.fetchLivePageIds();
        const survivingIds = saved.ownedTabIds.filter(id => liveTabs.has(id));
        if (survivingIds.length === 0) {
            if (this.isValidGroupName(saved.groupName)) {
                this.groupName = saved.groupName;
                this.groupColor = saved.groupColor;
            }
            else {
                this.assignNewGroupIdentity();
            }
            return;
        }
        survivingIds.forEach(id => this.ownedTabIds.add(id));
        if (this.isValidGroupName(saved.groupName)) {
            this.groupName = saved.groupName;
            this.groupColor = saved.groupColor;
        }
        else {
            this.assignNewGroupIdentity();
        }
        const groupStillExists = saved.chromeGroupId !== null && this.extensionClient
            ? await this.chromeGroupExists(saved.chromeGroupId)
            : false;
        this.chromeGroupId = groupStillExists ? saved.chromeGroupId : null;
        this.saveState();
    }
    async fetchLivePageIds() {
        try {
            const targets = await CDP.List({ port: this.debugPort });
            return new Set(targets.filter((t) => t.type === "page").map((t) => t.id));
        }
        catch {
            return new Set();
        }
    }
    async chromeGroupExists(groupId) {
        try {
            const { result } = await this.extensionClient.Runtime.evaluate({
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
    async findExtensionClient() {
        for (let attempt = 0; attempt < 6; attempt++) {
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
            await new Promise((r) => setTimeout(r, 500));
        }
        return null;
    }
    isValidGroupName(name) {
        return isAnimalName(name);
    }
    assignNewGroupIdentity() {
        const animal = nextAnimal();
        this.groupName = animal.name;
        this.groupColor = animal.chromeColor;
    }
    resetForNewSession() {
        this.ownedTabIds.clear();
        this.chromeGroupId = null;
        this.initPromise = null;
        this.extensionClient = null;
        this.clearState();
        this.assignNewGroupIdentity();
    }
    async addTab(cdpTabId) {
        await this.initialize();
        this.ownedTabIds.add(cdpTabId);
        this.addTabQueue = this.addTabQueue.then(() => this.tryAddToVisualGroup(cdpTabId));
        await this.addTabQueue;
        this.saveState();
        if (this.chromeGroupId === null)
            this.scheduleGroupRetry(cdpTabId);
    }
    scheduleGroupRetry(cdpTabId) {
        const delays = [1500, 3000, 5000];
        let attempt = 0;
        const retry = async () => {
            if (attempt >= delays.length || this.chromeGroupId !== null)
                return;
            this.extensionClient = null;
            await this.tryAddToVisualGroup(cdpTabId);
            this.saveState();
            if (this.chromeGroupId === null)
                setTimeout(retry, delays[attempt]);
            attempt++;
        };
        setTimeout(retry, delays[0]);
    }
    async tryAddToVisualGroup(cdpTabId) {
        if (!this.extensionClient) {
            this.extensionClient = await this.findExtensionClient();
        }
        if (!this.extensionClient)
            return;
        try {
            await new Promise((r) => setTimeout(r, 300));
            const { result: tabsResult } = await this.extensionClient.Runtime.evaluate({
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
            const chromeTabs = JSON.parse(tabsResult?.value ?? "[]");
            if (chromeTabs.length === 0)
                return;
            const targets = await CDP.List({ port: this.debugPort });
            const target = targets.find((t) => t.id === cdpTabId);
            const normalize = (u) => (u ?? "").replace(/\/$/, "");
            const targetUrl = target ? normalize(target.url) : "";
            const match = chromeTabs.find((t) => normalize(t.url) === targetUrl ||
                normalize(t.pendingUrl ?? "") === targetUrl) ?? chromeTabs[0];
            if (!match)
                return;
            const knownId = this.chromeGroupId;
            const expression = `(async () => {
            ${knownId !== null ? `try {
              return await chrome.tabs.group({ groupId: ${knownId}, tabIds: [${match.id}] });
            } catch {}` : ""}
            const existing = await chrome.tabGroups.query({ title: ${JSON.stringify(this.groupName)} });
            const existingId = existing[0]?.id ?? null;
            const gid = await chrome.tabs.group(
              existingId ? { groupId: existingId, tabIds: [${match.id}] } : { tabIds: [${match.id}] }
            );
            if (!existingId) {
              await chrome.tabGroups.update(gid, {
                title: ${JSON.stringify(this.groupName)},
                color: ${JSON.stringify(this.groupColor)}
              });
            }
            return gid;
          })()`;
            const { result } = await this.extensionClient.Runtime.evaluate({
                expression,
                returnByValue: true,
                awaitPromise: true,
            });
            if (typeof result?.value === "number") {
                this.chromeGroupId = result.value;
                this.saveState();
            }
        }
        catch {
            this.extensionClient = null;
        }
    }
    removeTab(tabId) {
        this.ownedTabIds.delete(tabId);
        if (this.ownedTabIds.size === 0) {
            this.clearState();
        }
        else {
            this.saveState();
        }
    }
    isOwned(tabId) {
        return this.ownedTabIds.has(tabId);
    }
    hasOwnedTabs() {
        return this.ownedTabIds.size > 0;
    }
    getOwnedTabIds() {
        return this.ownedTabIds;
    }
    getGroupName() {
        return this.groupName;
    }
    getGroupNumber() {
        const match = this.groupName.match(/#(\d+)/);
        return match ? parseInt(match[1], 10) : 1;
    }
    getGroupColor() {
        return this.groupColor;
    }
    async renameGroup(newTitle) {
        await this.initialize();
        if (!this.extensionClient || this.chromeGroupId === null)
            return false;
        try {
            await this.extensionClient.Runtime.evaluate({
                expression: `chrome.tabGroups.update(${this.chromeGroupId}, { title: ${JSON.stringify(newTitle)} })`,
                returnByValue: true,
                awaitPromise: true,
            });
            this.groupName = newTitle;
            this.saveState();
            return true;
        }
        catch {
            this.extensionClient = null;
            return false;
        }
    }
    async setGroupColor(color) {
        await this.initialize();
        const validColors = GROUP_COLORS;
        if (!validColors.includes(color))
            return false;
        if (!this.extensionClient || this.chromeGroupId === null)
            return false;
        try {
            await this.extensionClient.Runtime.evaluate({
                expression: `chrome.tabGroups.update(${this.chromeGroupId}, { color: ${JSON.stringify(color)} })`,
                returnByValue: true,
                awaitPromise: true,
            });
            this.groupColor = color;
            this.saveState();
            return true;
        }
        catch {
            this.extensionClient = null;
            return false;
        }
    }
    async getGroupState() {
        await this.initialize();
        if (this.extensionClient && this.chromeGroupId !== null) {
            try {
                const { result } = await this.extensionClient.Runtime.evaluate({
                    expression: `(async () => { const g = await chrome.tabGroups.get(${this.chromeGroupId}); return JSON.stringify({ name: g.title ?? '', color: g.color }); })()`,
                    returnByValue: true,
                    awaitPromise: true,
                });
                if (result?.value) {
                    const parsed = JSON.parse(result.value);
                    return { name: parsed.name, color: parsed.color, id: this.chromeGroupId };
                }
            }
            catch {
                this.extensionClient = null;
            }
        }
        return { name: this.groupName, color: this.groupColor, id: this.chromeGroupId };
    }
}
