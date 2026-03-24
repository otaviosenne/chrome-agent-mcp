import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync, readdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
function findKittyAncestor(pid) {
    let current = pid;
    for (let i = 0; i < 25; i++) {
        try {
            const comm = readFileSync(`/proc/${current}/comm`, "utf8").trim();
            if (comm === "kitty")
                return current;
            const status = readFileSync(`/proc/${current}/status`, "utf8");
            const match = status.match(/^PPid:\s+(\d+)/m);
            if (!match)
                break;
            const ppid = parseInt(match[1], 10);
            if (ppid <= 1)
                break;
            current = ppid;
        }
        catch {
            break;
        }
    }
    return null;
}
export const STATE_DIR = join(homedir(), ".local", "share", "chrome-agent-mcp");
function lastGroupFilePath(debugPort) {
    return join(STATE_DIR, `${debugPort}-last.json`);
}
export class GroupStateStore {
    stateFile;
    constructor(stateFile) {
        this.stateFile = stateFile;
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
    saveState(state) {
        try {
            mkdirSync(STATE_DIR, { recursive: true });
            writeFileSync(this.stateFile, JSON.stringify(state, null, 2));
        }
        catch { }
        if (state.chromeGroupId !== null) {
            const portMatch = this.stateFile.match(/\/(\d+)-\d+\.json$/);
            if (portMatch) {
                this.saveLastGroup(parseInt(portMatch[1], 10), state.groupName, state.groupColor, state.chromeGroupId);
            }
        }
    }
    deleteState() {
        try {
            if (existsSync(this.stateFile))
                unlinkSync(this.stateFile);
        }
        catch { }
    }
    loadLastGroup(debugPort) {
        try {
            const path = lastGroupFilePath(debugPort);
            if (!existsSync(path))
                return null;
            return JSON.parse(readFileSync(path, "utf8"));
        }
        catch {
            return null;
        }
    }
    saveLastGroup(debugPort, groupName, groupColor, chromeGroupId) {
        try {
            mkdirSync(STATE_DIR, { recursive: true });
            const entry = { groupName, groupColor, chromeGroupId };
            writeFileSync(lastGroupFilePath(debugPort), JSON.stringify(entry, null, 2));
        }
        catch { }
    }
    deleteLastGroup(debugPort) {
        try {
            const path = lastGroupFilePath(debugPort);
            if (existsSync(path))
                unlinkSync(path);
        }
        catch { }
    }
    static findSharedState(debugPort, myPid) {
        const myKittyPid = findKittyAncestor(myPid);
        if (!myKittyPid)
            return null;
        try {
            const prefix = `${debugPort}-`;
            const files = readdirSync(STATE_DIR).filter(f => f.startsWith(prefix) && f.endsWith(".json"));
            for (const file of files) {
                const match = file.match(/^(\d+)-(\d+)\.json$/);
                if (!match)
                    continue;
                const pid = parseInt(match[2], 10);
                if (pid === myPid || !isProcessAlive(pid))
                    continue;
                if (findKittyAncestor(pid) !== myKittyPid)
                    continue;
                try {
                    return JSON.parse(readFileSync(join(STATE_DIR, file), "utf8"));
                }
                catch { }
            }
        }
        catch { }
        return null;
    }
    static isGroupInUse(debugPort, groupId, myPid) {
        try {
            const prefix = `${debugPort}-`;
            const files = readdirSync(STATE_DIR).filter((f) => f.startsWith(prefix) && f.endsWith(".json") && !f.includes("last"));
            for (const file of files) {
                const match = file.match(/^\d+-(\d+)\.json$/);
                if (!match)
                    continue;
                const pid = parseInt(match[1], 10);
                if (pid === myPid || !isProcessAlive(pid))
                    continue;
                try {
                    const state = JSON.parse(readFileSync(join(STATE_DIR, file), "utf8"));
                    if (state.chromeGroupId === groupId)
                        return true;
                }
                catch { }
            }
        }
        catch { }
        return false;
    }
    static cleanupDeadProcessFiles() {
        try {
            const files = readdirSync(STATE_DIR).filter(f => /^\d+-\d+\.json$/.test(f));
            for (const file of files) {
                const match = file.match(/^(\d+)-(\d+)\.json$/);
                if (!match)
                    continue;
                const pid = parseInt(match[2], 10);
                if (!isProcessAlive(pid)) {
                    try {
                        unlinkSync(join(STATE_DIR, file));
                    }
                    catch { }
                }
            }
        }
        catch { }
    }
}
function isProcessAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    }
    catch {
        return false;
    }
}
