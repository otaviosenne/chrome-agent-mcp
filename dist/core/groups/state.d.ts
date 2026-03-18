export declare const STATE_DIR: string;
export interface PersistedState {
    chromeGroupId: number | null;
    groupName: string;
    groupColor: string;
    ownedTabIds: string[];
}
export declare class GroupStateStore {
    private readonly stateFile;
    constructor(stateFile: string);
    loadState(): PersistedState | null;
    saveState(state: PersistedState): void;
    deleteState(): void;
    static cleanupDeadProcessFiles(): void;
}
