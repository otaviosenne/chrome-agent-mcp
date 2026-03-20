import { describe, it, expect, vi, beforeEach } from "vitest";
import { GroupStateStore, PersistedState } from "../../../src/core/groups/state.js";
import * as fs from "fs";

vi.mock("fs");

const MOCK_STATE_FILE = "/tmp/mock-state.json";
const MOCK_SHARED_FILE = "/tmp/shared-state.json";

const ANIMAL_STATE: PersistedState = {
  chromeGroupId: 10,
  groupName: "Pinguim",
  groupColor: "blue",
  ownedTabIds: ["tab-abc"],
};

describe("GroupStateStore - reconnect: last group file", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("saveLastGroup writes group identity to shared port file", () => {
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
    vi.mocked(fs.writeFileSync).mockReturnValue(undefined);

    const store = new GroupStateStore(MOCK_STATE_FILE);
    store.saveLastGroup(9222, ANIMAL_STATE.groupName, ANIMAL_STATE.groupColor, ANIMAL_STATE.chromeGroupId!);

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining("9222"),
      expect.any(String)
    );
  });

  it("loadLastGroup returns saved group identity for a port", () => {
    const payload = JSON.stringify({
      groupName: "Pinguim",
      groupColor: "blue",
      chromeGroupId: 10,
    });
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(payload as unknown as Buffer);

    const store = new GroupStateStore(MOCK_STATE_FILE);
    const result = store.loadLastGroup(9222);

    expect(result).not.toBeNull();
    expect(result!.groupName).toBe("Pinguim");
    expect(result!.groupColor).toBe("blue");
    expect(result!.chromeGroupId).toBe(10);
  });

  it("loadLastGroup returns null when file does not exist", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const store = new GroupStateStore(MOCK_STATE_FILE);
    const result = store.loadLastGroup(9222);

    expect(result).toBeNull();
  });

  it("loadLastGroup returns null when file contains invalid JSON", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue("bad-json" as unknown as Buffer);

    const store = new GroupStateStore(MOCK_STATE_FILE);
    const result = store.loadLastGroup(9222);

    expect(result).toBeNull();
  });

  it("deleteLastGroup removes the shared port file", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const store = new GroupStateStore(MOCK_STATE_FILE);
    store.deleteLastGroup(9222);

    expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining("9222"));
  });

  it("deleteLastGroup does not throw when file is missing", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const store = new GroupStateStore(MOCK_STATE_FILE);
    expect(() => store.deleteLastGroup(9222)).not.toThrow();
  });
});

describe("GroupStateStore - reconnect: group name stability", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("cleanupDeadProcessFiles preserves the last-group file", () => {
    const files = ["9222-1234.json", "9222-5678.json", "9222-last.json"];
    vi.mocked(fs.readdirSync).mockReturnValue(files as unknown as fs.Dirent[]);
    vi.mocked(fs.unlinkSync).mockReturnValue(undefined);

    const killSpy = vi.spyOn(process, "kill").mockImplementation((pid) => {
      throw Object.assign(new Error("ESRCH"), { code: "ESRCH" });
    });

    GroupStateStore.cleanupDeadProcessFiles();

    const deletedFiles = vi.mocked(fs.unlinkSync).mock.calls.map(c => c[0] as string);
    expect(deletedFiles.some(f => f.includes("last"))).toBe(false);

    killSpy.mockRestore();
  });
});

describe("GroupStateStore - reconnect: saveState updates last-group", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("saveState also persists last-group when state has chromeGroupId and valid name", () => {
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
    const writtenFiles: string[] = [];
    vi.mocked(fs.writeFileSync).mockImplementation((path) => {
      writtenFiles.push(path as string);
    });

    const store = new GroupStateStore("/tmp/9222-99.json");
    store.saveState(ANIMAL_STATE);

    const lastGroupWrite = writtenFiles.some(f => f.includes("last"));
    expect(lastGroupWrite).toBe(true);
  });

  it("saveState does not write last-group file when chromeGroupId is null", () => {
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
    const writtenFiles: string[] = [];
    vi.mocked(fs.writeFileSync).mockImplementation((path) => {
      writtenFiles.push(path as string);
    });

    const stateWithoutGroup: PersistedState = { ...ANIMAL_STATE, chromeGroupId: null };
    const store = new GroupStateStore("/tmp/9222-99.json");
    store.saveState(stateWithoutGroup);

    const lastGroupWrite = writtenFiles.some(f => f.includes("last"));
    expect(lastGroupWrite).toBe(false);
  });
});
