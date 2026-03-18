import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync, readdirSync } from "fs";
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

  deleteState(): void {
    try {
      if (existsSync(this.stateFile)) unlinkSync(this.stateFile);
    } catch {}
  }

  static cleanupDeadProcessFiles(): void {
    try {
      const files = readdirSync(STATE_DIR).filter(f => /^\d+-\d+\.json$/.test(f));
      for (const file of files) {
        const match = file.match(/^(\d+)-(\d+)\.json$/);
        if (!match) continue;
        const pid = parseInt(match[2], 10);
        if (!isProcessAlive(pid)) {
          try { unlinkSync(join(STATE_DIR, file)); } catch {}
        }
      }
    } catch {}
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
