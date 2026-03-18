import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GroupStateStore, PersistedState } from "../../../src/core/groups/state.js";
import * as fs from "fs";

vi.mock("fs");

const MOCK_STATE_FILE = "/tmp/mock-state.json";

const SAMPLE_STATE: PersistedState = {
  chromeGroupId: 42,
  groupName: "Pinguim",
  groupColor: "blue",
  ownedTabIds: ["tab1", "tab2"],
};

describe("GroupStateStore.loadState", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns null when state file does not exist", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const store = new GroupStateStore(MOCK_STATE_FILE);
    expect(store.loadState()).toBeNull();
  });

  it("returns parsed state when file exists and is valid", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(SAMPLE_STATE) as unknown as Buffer);
    const store = new GroupStateStore(MOCK_STATE_FILE);
    expect(store.loadState()).toEqual(SAMPLE_STATE);
  });

  it("returns null when file contains invalid JSON", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue("not-json" as unknown as Buffer);
    const store = new GroupStateStore(MOCK_STATE_FILE);
    expect(store.loadState()).toBeNull();
  });

  it("returns null when readFileSync throws", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockImplementation(() => { throw new Error("permission denied"); });
    const store = new GroupStateStore(MOCK_STATE_FILE);
    expect(store.loadState()).toBeNull();
  });
});

describe("GroupStateStore.saveState", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("calls mkdirSync and writeFileSync when saving", () => {
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
    vi.mocked(fs.writeFileSync).mockReturnValue(undefined);
    const store = new GroupStateStore(MOCK_STATE_FILE);
    store.saveState(SAMPLE_STATE);
    expect(fs.mkdirSync).toHaveBeenCalled();
    expect(fs.writeFileSync).toHaveBeenCalledWith(MOCK_STATE_FILE, expect.any(String));
  });

  it("writes valid JSON that can be parsed back", () => {
    let written = "";
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
    vi.mocked(fs.writeFileSync).mockImplementation((_path, data) => { written = data as string; });
    const store = new GroupStateStore(MOCK_STATE_FILE);
    store.saveState(SAMPLE_STATE);
    const parsed = JSON.parse(written) as PersistedState;
    expect(parsed.chromeGroupId).toBe(42);
    expect(parsed.groupName).toBe("Pinguim");
    expect(parsed.ownedTabIds).toEqual(["tab1", "tab2"]);
  });

  it("does not throw when writeFileSync fails", () => {
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
    vi.mocked(fs.writeFileSync).mockImplementation(() => { throw new Error("disk full"); });
    const store = new GroupStateStore(MOCK_STATE_FILE);
    expect(() => store.saveState(SAMPLE_STATE)).not.toThrow();
  });
});

describe("GroupStateStore.deleteState", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("does not call unlinkSync when file does not exist", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const store = new GroupStateStore(MOCK_STATE_FILE);
    store.deleteState();
    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });

  it("calls unlinkSync when file exists", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const store = new GroupStateStore(MOCK_STATE_FILE);
    store.deleteState();
    expect(fs.unlinkSync).toHaveBeenCalledWith(MOCK_STATE_FILE);
  });

  it("does not throw when unlinkSync fails", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.unlinkSync).mockImplementation(() => { throw new Error("permission denied"); });
    const store = new GroupStateStore(MOCK_STATE_FILE);
    expect(() => store.deleteState()).not.toThrow();
  });
});
