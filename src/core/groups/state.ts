import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

export const STATE_DIR = join(homedir(), ".local", "share", "chrome-agent-mcp");

export interface PersistedState {
  chromeGroupId: number | null;
  groupName: string;
  groupColor: string;
  ownedTabIds: string[];
}

export class GroupStateStore {
  private readonly stateFile: string;

  constructor(stateFile: string) {
    this.stateFile = stateFile;
  }

  loadState(): PersistedState | null {
    try {
      if (!existsSync(this.stateFile)) return null;
      return JSON.parse(readFileSync(this.stateFile, "utf8")) as PersistedState;
    } catch {
      return null;
    }
  }

  saveState(state: PersistedState): void {
    try {
      mkdirSync(STATE_DIR, { recursive: true });
      writeFileSync(this.stateFile, JSON.stringify(state, null, 2));
    } catch {}
  }

  clearState(groupName: string, groupColor: string): void {
    try {
      if (existsSync(this.stateFile)) {
        writeFileSync(
          this.stateFile,
          JSON.stringify({ chromeGroupId: null, groupName, groupColor, ownedTabIds: [] }, null, 2)
        );
      }
    } catch {}
  }
}
