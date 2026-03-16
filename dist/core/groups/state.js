import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
export const STATE_DIR = join(homedir(), ".local", "share", "chrome-agent-mcp");
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
    }
    clearState(groupName, groupColor) {
        try {
            if (existsSync(this.stateFile)) {
                writeFileSync(this.stateFile, JSON.stringify({ chromeGroupId: null, groupName, groupColor, ownedTabIds: [] }, null, 2));
            }
        }
        catch { }
    }
}
