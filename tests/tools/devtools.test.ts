import { describe, it, expect, vi } from "vitest";
import type { ChromeConnection } from "../../src/core/connection.js";
import type { ConsoleEntry, NetworkRequest } from "../../src/types.js";
import { handleDevtoolsConsole } from "../../src/tools/devtools/console.js";
import { handleDevtoolsNetwork } from "../../src/tools/devtools/network.js";

function createMockConnection(overrides: Partial<any> = {}): ChromeConnection {
  return {
    listTabs: vi.fn().mockResolvedValue([
      { id: "tab1", title: "Tab", url: "https://example.com", type: "page", webSocketDebuggerUrl: "" },
    ]),
    getClient: vi.fn().mockResolvedValue({}),
    getClientForTab: vi.fn().mockResolvedValue({}),
    newTab: vi.fn().mockResolvedValue({ id: "tab1", title: "New Tab", url: "about:blank", type: "page", webSocketDebuggerUrl: "" }),
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
      getOwnedTabIds: vi.fn().mockReturnValue(new Set(["tab1"])),
    },
    ...overrides,
  } as unknown as ChromeConnection;
}

function makeConsoleEntry(level: string, text: string): ConsoleEntry {
  return { level, text, timestamp: Date.now() };
}

function makeNetworkRequest(method: string, url: string, resourceType = "XHR"): NetworkRequest {
  return {
    requestId: "req-1",
    method,
    url,
    resourceType,
    status: 200,
    statusText: "OK",
    startTime: Date.now(),
    duration: 0.05,
  };
}

describe("handleDevtoolsConsole - start action", () => {
  it("enables console monitoring for active tab", async () => {
    const connection = createMockConnection();
    const result = await handleDevtoolsConsole({ action: "start" }, connection);

    expect(connection.enableConsoleMonitoring).toHaveBeenCalledWith("tab1");
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("tab1");
  });

  it("uses provided tabId over active tab", async () => {
    const connection = createMockConnection();
    await handleDevtoolsConsole({ action: "start", tabId: "tab2" }, connection);

    expect(connection.enableConsoleMonitoring).toHaveBeenCalledWith("tab2");
  });
});

describe("handleDevtoolsConsole - clear action", () => {
  it("clears console log for the tab", async () => {
    const connection = createMockConnection();
    const result = await handleDevtoolsConsole({ action: "clear" }, connection);

    expect(connection.clearConsoleLog).toHaveBeenCalledWith("tab1");
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("cleared");
  });
});

describe("handleDevtoolsConsole - list action", () => {
  it("returns formatted console logs when entries exist", async () => {
    const entries: ConsoleEntry[] = [
      makeConsoleEntry("log", "Page loaded"),
      makeConsoleEntry("error", "Something went wrong"),
    ];
    const connection = createMockConnection({
      getConsoleLog: vi.fn().mockReturnValue(entries),
    });

    const result = await handleDevtoolsConsole({ action: "list" }, connection);

    expect(connection.getConsoleLog).toHaveBeenCalledWith("tab1");
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Page loaded");
    expect(result.content[0].text).toContain("Something went wrong");
    expect(result.content[0].text).toContain("LOG");
    expect(result.content[0].text).toContain("ERROR");
  });

  it("returns guidance message when no logs available", async () => {
    const connection = createMockConnection({
      getConsoleLog: vi.fn().mockReturnValue([]),
    });

    const result = await handleDevtoolsConsole({ action: "list" }, connection);

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("action=start");
  });

  it("filters logs by level when level is specified", async () => {
    const entries: ConsoleEntry[] = [
      makeConsoleEntry("log", "Info message"),
      makeConsoleEntry("error", "Error message"),
    ];
    const connection = createMockConnection({
      getConsoleLog: vi.fn().mockReturnValue(entries),
    });

    const result = await handleDevtoolsConsole({ action: "list", level: "error" }, connection);

    expect(result.content[0].text).toContain("Error message");
    expect(result.content[0].text).not.toContain("Info message");
  });

  it("returns isError when no tabs available", async () => {
    const connection = createMockConnection({
      listTabs: vi.fn().mockResolvedValue([]),
      getActiveTabId: vi.fn().mockReturnValue(null),
    });

    const result = await handleDevtoolsConsole({ action: "list" }, connection);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("No tab available");
  });
});

describe("handleDevtoolsNetwork - start action", () => {
  it("enables network monitoring for active tab", async () => {
    const connection = createMockConnection();
    const result = await handleDevtoolsNetwork({ action: "start" }, connection);

    expect(connection.enableNetworkMonitoring).toHaveBeenCalledWith("tab1");
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("tab1");
  });

  it("uses provided tabId over active tab", async () => {
    const connection = createMockConnection();
    await handleDevtoolsNetwork({ action: "start", tabId: "tab2" }, connection);

    expect(connection.enableNetworkMonitoring).toHaveBeenCalledWith("tab2");
  });
});

describe("handleDevtoolsNetwork - clear action", () => {
  it("clears network log for the tab", async () => {
    const connection = createMockConnection();
    const result = await handleDevtoolsNetwork({ action: "clear" }, connection);

    expect(connection.clearNetworkLog).toHaveBeenCalledWith("tab1");
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("cleared");
  });
});

describe("handleDevtoolsNetwork - list action", () => {
  it("returns formatted network requests when entries exist", async () => {
    const requests: NetworkRequest[] = [
      makeNetworkRequest("GET", "https://api.example.com/data"),
      makeNetworkRequest("POST", "https://api.example.com/submit"),
    ];
    const connection = createMockConnection({
      getNetworkLog: vi.fn().mockReturnValue(requests),
    });

    const result = await handleDevtoolsNetwork({ action: "list" }, connection);

    expect(connection.getNetworkLog).toHaveBeenCalledWith("tab1");
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("GET");
    expect(result.content[0].text).toContain("POST");
    expect(result.content[0].text).toContain("https://api.example.com");
  });

  it("returns guidance message when no requests captured", async () => {
    const connection = createMockConnection({
      getNetworkLog: vi.fn().mockReturnValue([]),
    });

    const result = await handleDevtoolsNetwork({ action: "list" }, connection);

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("action=start");
  });

  it("filters by resourceType when filter is specified", async () => {
    const requests: NetworkRequest[] = [
      makeNetworkRequest("GET", "https://example.com/api", "XHR"),
      makeNetworkRequest("GET", "https://example.com/style.css", "Stylesheet"),
    ];
    const connection = createMockConnection({
      getNetworkLog: vi.fn().mockReturnValue(requests),
    });

    const result = await handleDevtoolsNetwork({ action: "list", filter: "XHR" }, connection);

    expect(result.content[0].text).toContain("/api");
    expect(result.content[0].text).not.toContain("style.css");
  });

  it("filters by urlContains when specified", async () => {
    const requests: NetworkRequest[] = [
      makeNetworkRequest("GET", "https://example.com/users"),
      makeNetworkRequest("GET", "https://example.com/products"),
    ];
    const connection = createMockConnection({
      getNetworkLog: vi.fn().mockReturnValue(requests),
    });

    const result = await handleDevtoolsNetwork({ action: "list", urlContains: "users" }, connection);

    expect(result.content[0].text).toContain("/users");
    expect(result.content[0].text).not.toContain("/products");
  });

  it("returns isError when no tabs available", async () => {
    const connection = createMockConnection({
      listTabs: vi.fn().mockResolvedValue([]),
      getActiveTabId: vi.fn().mockReturnValue(null),
    });

    const result = await handleDevtoolsNetwork({ action: "list" }, connection);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("No tab available");
  });
});
