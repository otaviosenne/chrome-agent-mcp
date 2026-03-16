import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ChromeConnection } from "../../src/core/connection.js";
import { handleTabs } from "../../src/tools/tabs.js";

function createMockConnection(overrides: Partial<any> = {}): ChromeConnection {
  return {
    listTabs: vi.fn().mockResolvedValue([
      { id: "tab1", title: "Tab One", url: "https://example.com", type: "page", webSocketDebuggerUrl: "" },
      { id: "tab2", title: "Tab Two", url: "https://other.com", type: "page", webSocketDebuggerUrl: "" },
    ]),
    getClient: vi.fn().mockResolvedValue({}),
    getClientForTab: vi.fn().mockResolvedValue({}),
    newTab: vi.fn().mockResolvedValue({ id: "tab3", title: "New Tab", url: "about:blank", type: "page", webSocketDebuggerUrl: "" }),
    closeTab: vi.fn().mockResolvedValue(undefined),
    setActiveTab: vi.fn(),
    getActiveTabId: vi.fn().mockReturnValue("tab1"),
    enableNetworkMonitoring: vi.fn().mockResolvedValue(undefined),
    enableConsoleMonitoring: vi.fn().mockResolvedValue(undefined),
    getNetworkLog: vi.fn().mockReturnValue([]),
    getConsoleLog: vi.fn().mockReturnValue([]),
    clearNetworkLog: vi.fn(),
    clearConsoleLog: vi.fn(),
    getMousePosition: vi.fn().mockReturnValue({ x: 0, y: 0 }),
    setMousePosition: vi.fn(),
    smoothMouseMove: vi.fn().mockResolvedValue(undefined),
    tabGroup: {
      initialize: vi.fn().mockResolvedValue(undefined),
      getGroupName: vi.fn().mockReturnValue("TestGroup"),
      getGroupColor: vi.fn().mockReturnValue("blue"),
      addTab: vi.fn().mockResolvedValue(undefined),
      removeTab: vi.fn(),
      isOwned: vi.fn().mockReturnValue(true),
      hasOwnedTabs: vi.fn().mockReturnValue(true),
      getOwnedTabIds: vi.fn().mockReturnValue(new Set(["tab1", "tab2"])),
    },
    ...overrides,
  } as unknown as ChromeConnection;
}

describe("handleTabs - list action", () => {
  it("calls listTabs and returns formatted tab list", async () => {
    const connection = createMockConnection();
    const result = await handleTabs({ action: "list" }, connection);

    expect(connection.listTabs).toHaveBeenCalled();
    expect(result.isError).toBeUndefined();
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("tab1");
    expect(result.content[0].text).toContain("Tab One");
    expect(result.content[0].text).toContain("https://example.com");
  });

  it("includes group name in list header when group has tabs", async () => {
    const connection = createMockConnection();
    const result = await handleTabs({ action: "list" }, connection);

    expect(result.content[0].text).toContain("Group: TestGroup");
  });

  it("shows no-group message when no owned tabs", async () => {
    const connection = createMockConnection({
      tabGroup: {
        getGroupName: vi.fn().mockReturnValue("TestGroup"),
        hasOwnedTabs: vi.fn().mockReturnValue(false),
        getOwnedTabIds: vi.fn().mockReturnValue(new Set()),
        isOwned: vi.fn().mockReturnValue(false),
      },
    });
    const result = await handleTabs({ action: "list" }, connection);

    expect(result.content[0].text).toContain("No group active yet");
  });
});

describe("handleTabs - new action", () => {
  it("calls newTab and returns new tab info", async () => {
    const connection = createMockConnection();
    const result = await handleTabs({ action: "new" }, connection);

    expect(connection.newTab).toHaveBeenCalledWith(undefined);
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("tab3");
  });

  it("calls newTab with provided url", async () => {
    const connection = createMockConnection();
    await handleTabs({ action: "new", url: "https://google.com" }, connection);

    expect(connection.newTab).toHaveBeenCalledWith("https://google.com");
  });

  it("includes group name in new tab response", async () => {
    const connection = createMockConnection();
    const result = await handleTabs({ action: "new" }, connection);

    expect(result.content[0].text).toContain("TestGroup");
  });
});

describe("handleTabs - close action", () => {
  it("calls closeTab with provided tabId", async () => {
    const connection = createMockConnection();
    const result = await handleTabs({ action: "close", tabId: "tab1" }, connection);

    expect(connection.closeTab).toHaveBeenCalledWith("tab1");
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Closed tab");
  });

  it("closes tab by index", async () => {
    const connection = createMockConnection();
    const result = await handleTabs({ action: "close", index: 1 }, connection);

    expect(connection.closeTab).toHaveBeenCalledWith("tab2");
    expect(result.isError).toBeUndefined();
  });

  it("returns error when tabId not found", async () => {
    const connection = createMockConnection();
    const result = await handleTabs({ action: "close", tabId: "nonexistent" }, connection);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Tab not found");
  });

  it("returns error when neither tabId nor index provided", async () => {
    const connection = createMockConnection();
    const result = await handleTabs({ action: "close" }, connection);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Provide tabId or a valid index");
  });
});

describe("handleTabs - switch action", () => {
  it("calls setActiveTab with provided tabId", async () => {
    const connection = createMockConnection();
    const result = await handleTabs({ action: "switch", tabId: "tab2" }, connection);

    expect(connection.setActiveTab).toHaveBeenCalledWith("tab2");
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("tab2");
  });
});

describe("handleTabs - invalid action", () => {
  it("returns isError for unknown action with valid tabId", async () => {
    const connection = createMockConnection();
    const result = await handleTabs({ action: "unknown", tabId: "tab1" }, connection);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("unknown");
  });

  it("returns isError when no tabId provided for action needing resolution", async () => {
    const connection = createMockConnection();
    const result = await handleTabs({ action: "close" }, connection);

    expect(result.isError).toBe(true);
  });
});
