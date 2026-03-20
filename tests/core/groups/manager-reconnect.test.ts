import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";

vi.mock("fs");
vi.mock("chrome-remote-interface", () => ({
  default: Object.assign(vi.fn(), {
    List: vi.fn().mockResolvedValue([]),
    New: vi.fn().mockResolvedValue({ id: "new-tab", url: "about:blank" }),
  }),
}));

vi.mock("../../../src/utils/identity.js", () => ({
  nextAnimal: vi.fn().mockReturnValue({ name: "Zebra", chromeColor: "orange" }),
  isAnimalName: vi.fn().mockReturnValue(true),
}));

vi.mock("../../../src/core/groups/chrome-api.js", () => {
  function GroupChromeApi() {
    return {
      findExtensionClient: vi.fn().mockResolvedValue(null),
      chromeGroupExists: vi.fn().mockResolvedValue(false),
      tryAddToVisualGroup: vi.fn().mockResolvedValue(null),
      ungroupChromeTabs: vi.fn().mockResolvedValue(undefined),
    };
  }
  return { GroupChromeApi };
});

const { TabGroupManager } = await import("../../../src/core/groups/manager.js");
const { GroupStateStore } = await import("../../../src/core/groups/state.js");

const PINGUIM_LAST_GROUP = {
  groupName: "Pinguim",
  groupColor: "blue",
  chromeGroupId: 42,
};

function buildMockStore(lastGroup: typeof PINGUIM_LAST_GROUP | null, ownedState = null) {
  return {
    loadState: vi.fn().mockReturnValue(ownedState),
    saveState: vi.fn(),
    deleteState: vi.fn(),
    saveLastGroup: vi.fn(),
    loadLastGroup: vi.fn().mockReturnValue(lastGroup),
    deleteLastGroup: vi.fn(),
  };
}

describe("TabGroupManager - reconnect: reuses last group name", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.readdirSync).mockReturnValue([] as unknown as fs.Dirent[]);
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
    vi.mocked(fs.writeFileSync).mockReturnValue(undefined);
  });

  it("uses last group name from store when no owned-state file exists", async () => {
    const mockStore = buildMockStore(PINGUIM_LAST_GROUP);
    vi.spyOn(GroupStateStore.prototype, "loadState").mockReturnValue(null);
    vi.spyOn(GroupStateStore.prototype, "loadLastGroup").mockReturnValue(PINGUIM_LAST_GROUP);
    vi.spyOn(GroupStateStore.prototype, "saveState").mockReturnValue(undefined);
    vi.spyOn(GroupStateStore.prototype, "deleteState").mockReturnValue(undefined);

    const manager = new TabGroupManager(9222);
    await manager.initialize();

    expect(manager.getGroupName()).toBe("Pinguim");
  });

  it("generates a new identity when no last group file exists", async () => {
    vi.spyOn(GroupStateStore.prototype, "loadState").mockReturnValue(null);
    vi.spyOn(GroupStateStore.prototype, "loadLastGroup").mockReturnValue(null);
    vi.spyOn(GroupStateStore.prototype, "saveState").mockReturnValue(undefined);
    vi.spyOn(GroupStateStore.prototype, "deleteState").mockReturnValue(undefined);

    const manager = new TabGroupManager(9222);
    await manager.initialize();

    expect(manager.getGroupName()).toBe("Zebra");
  });

  it("group name is stable across two reconnects to same port", async () => {
    vi.spyOn(GroupStateStore.prototype, "loadState").mockReturnValue(null);
    vi.spyOn(GroupStateStore.prototype, "loadLastGroup").mockReturnValue(PINGUIM_LAST_GROUP);
    vi.spyOn(GroupStateStore.prototype, "saveState").mockReturnValue(undefined);
    vi.spyOn(GroupStateStore.prototype, "deleteState").mockReturnValue(undefined);

    const manager1 = new TabGroupManager(9222);
    await manager1.initialize();
    const name1 = manager1.getGroupName();

    const manager2 = new TabGroupManager(9222);
    await manager2.initialize();
    const name2 = manager2.getGroupName();

    expect(name1).toBe("Pinguim");
    expect(name2).toBe("Pinguim");
  });

  it("resetForNewSession calls deleteLastGroup to clear port-level identity", async () => {
    vi.spyOn(GroupStateStore.prototype, "loadState").mockReturnValue(null);
    vi.spyOn(GroupStateStore.prototype, "loadLastGroup").mockReturnValue(PINGUIM_LAST_GROUP);
    vi.spyOn(GroupStateStore.prototype, "saveState").mockReturnValue(undefined);
    vi.spyOn(GroupStateStore.prototype, "deleteState").mockReturnValue(undefined);
    const deleteLastGroupSpy = vi.spyOn(GroupStateStore.prototype, "deleteLastGroup").mockReturnValue(undefined);

    const manager = new TabGroupManager(9222);
    await manager.initialize();
    await manager.resetForNewSession();

    expect(deleteLastGroupSpy).toHaveBeenCalledWith(9222);
  });

  it("after resetForNewSession, new initialize gets fresh identity", async () => {
    const loadLastGroupSpy = vi.spyOn(GroupStateStore.prototype, "loadLastGroup")
      .mockReturnValueOnce(PINGUIM_LAST_GROUP)
      .mockReturnValueOnce(null);
    vi.spyOn(GroupStateStore.prototype, "loadState").mockReturnValue(null);
    vi.spyOn(GroupStateStore.prototype, "saveState").mockReturnValue(undefined);
    vi.spyOn(GroupStateStore.prototype, "deleteState").mockReturnValue(undefined);
    vi.spyOn(GroupStateStore.prototype, "deleteLastGroup").mockReturnValue(undefined);

    const manager = new TabGroupManager(9222);
    await manager.initialize();
    expect(manager.getGroupName()).toBe("Pinguim");

    await manager.resetForNewSession();
    await manager.initialize();

    expect(manager.getGroupName()).toBe("Zebra");
  });
});
