export declare const STATE_DIR: string;
export interface PersistedState {
    chromeGroupId: number | null;
    groupName: string;
    groupColor: string;
    ownedTabIds: string[];
}
export interface LastGroupEntry {
    groupName: string;
    groupColor: string;
    chromeGroupId: number;
}
export declare class GroupStateStore {
    private readonly stateFile;
    constructor(stateFile: string);
    loadState(): PersistedState | null;
    saveState(state: PersistedState): void;
    deleteState(): void;
    loadLastGroup(debugPort: number): LastGroupEntry | null;
    saveLastGroup(debugPort: number, groupName: string, groupColor: string, chromeGroupId: number): void;
    deleteLastGroup(debugPort: number): void;
    static findSharedState(debugPort: number, myPid: number): PersistedState | null;
    static cleanupDeadProcessFiles(): void;
}
