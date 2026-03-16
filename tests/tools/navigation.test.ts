import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ChromeConnection } from "../../src/core/connection.js";
import {
  handleNavigate,
  handleNavigateBack,
  handleNavigateForward,
  handleReload,
} from "../../src/tools/navigation.js";

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

function createMockClient(overrides: Partial<any> = {}): any {
  return {
    Page: {
      navigate: vi.fn().mockResolvedValue({}),
      goBack: vi.fn().mockResolvedValue({}),
      goForward: vi.fn().mockResolvedValue({}),
      reload: vi.fn().mockResolvedValue({}),
      loadEventFired: vi.fn().mockImplementation((cb: () => void) => cb()),
      enable: vi.fn().mockResolvedValue({}),
    },
    Runtime: {
      evaluate: vi.fn().mockResolvedValue({ result: { value: "https://example.com", type: "string" } }),
      enable: vi.fn().mockResolvedValue({}),
    },
    ...overrides,
  };
}

function createMockConnection(clientOverrides: Partial<any> = {}, connOverrides: Partial<any> = {}): ChromeConnection {
  const mockClient = createMockClient(clientOverrides);
  return {
    listTabs: vi.fn().mockResolvedValue([
      { id: "tab1", title: "Tab One", url: "https://example.com", type: "page", webSocketDebuggerUrl: "" },
    ]),
    getClient: vi.fn().mockResolvedValue(mockClient),
    getClientForTab: vi.fn().mockResolvedValue(mockClient),
    newTab: vi.fn().mockResolvedValue({ id: "tab-new", title: "New Tab", url: "https://google.com", type: "page", webSocketDebuggerUrl: "" }),
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
    ...connOverrides,
  } as unknown as ChromeConnection;
}

describe("handleNavigate", () => {
  it("navigates to url using existing tab when group has tabs", async () => {
    const mockClient = createMockClient({
      Runtime: {
        evaluate: vi.fn().mockResolvedValue({ result: { value: "Example Domain", type: "string" } }),
        enable: vi.fn().mockResolvedValue({}),
      },
    });
    const connection = createMockConnection({}, {
      getClient: vi.fn().mockResolvedValue(mockClient),
      tabGroup: {
        hasOwnedTabs: vi.fn().mockReturnValue(true),
        getGroupName: vi.fn().mockReturnValue("TestGroup"),
        getGroupColor: vi.fn().mockReturnValue("blue"),
        getOwnedTabIds: vi.fn().mockReturnValue(new Set(["tab1"])),
        isOwned: vi.fn().mockReturnValue(true),
        addTab: vi.fn().mockResolvedValue(undefined),
        removeTab: vi.fn(),
      },
    });

    const p = handleNavigate({ url: "https://example.com" }, connection);
    await vi.runAllTimersAsync();
    const result = await p;

    expect(mockClient.Page.navigate).toHaveBeenCalledWith({ url: "https://example.com" });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("https://example.com");
  });

  it("creates new tab when no owned tabs and no explicit tabId", async () => {
    const connection = createMockConnection({}, {
      tabGroup: {
        hasOwnedTabs: vi.fn().mockReturnValue(false),
        getGroupName: vi.fn().mockReturnValue("TestGroup"),
        getGroupColor: vi.fn().mockReturnValue("blue"),
        getOwnedTabIds: vi.fn().mockReturnValue(new Set()),
        isOwned: vi.fn().mockReturnValue(false),
        addTab: vi.fn().mockResolvedValue(undefined),
        removeTab: vi.fn(),
      },
    });

    const p = handleNavigate({ url: "https://google.com" }, connection);
    await vi.runAllTimersAsync();
    const result = await p;

    expect(connection.newTab).toHaveBeenCalledWith("https://google.com");
    expect(result.content[0].text).toContain("https://google.com");
  });

  it("includes page title in result", async () => {
    const mockClient = createMockClient({
      Runtime: {
        evaluate: vi.fn().mockResolvedValue({ result: { value: "My Page Title", type: "string" } }),
        enable: vi.fn().mockResolvedValue({}),
      },
    });
    const connection = createMockConnection({}, {
      getClient: vi.fn().mockResolvedValue(mockClient),
    });

    const p = handleNavigate({ url: "https://example.com" }, connection);
    await vi.runAllTimersAsync();
    const result = await p;

    expect(result.content[0].text).toContain("My Page Title");
  });
});

describe("handleNavigateBack", () => {
  it("calls Page.goBack and returns current url", async () => {
    const mockClient = createMockClient({
      Runtime: {
        evaluate: vi.fn().mockResolvedValue({ result: { value: "https://previous.com", type: "string" } }),
        enable: vi.fn().mockResolvedValue({}),
      },
    });
    const connection = createMockConnection({}, {
      getClient: vi.fn().mockResolvedValue(mockClient),
    });

    const p = handleNavigateBack({}, connection);
    await vi.runAllTimersAsync();
    const result = await p;

    expect(mockClient.Page.goBack).toHaveBeenCalled();
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("https://previous.com");
  });

  it("passes tabId to getClient", async () => {
    const connection = createMockConnection();
    const p = handleNavigateBack({ tabId: "tab2" }, connection);
    await vi.runAllTimersAsync();
    await p;

    expect(connection.getClient).toHaveBeenCalledWith("tab2");
  });
});

describe("handleNavigateForward", () => {
  it("calls Page.goForward and returns current url", async () => {
    const mockClient = createMockClient({
      Runtime: {
        evaluate: vi.fn().mockResolvedValue({ result: { value: "https://forward.com", type: "string" } }),
        enable: vi.fn().mockResolvedValue({}),
      },
    });
    const connection = createMockConnection({}, {
      getClient: vi.fn().mockResolvedValue(mockClient),
    });

    const p = handleNavigateForward({}, connection);
    await vi.runAllTimersAsync();
    const result = await p;

    expect(mockClient.Page.goForward).toHaveBeenCalled();
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("https://forward.com");
  });
});

describe("handleReload", () => {
  it("calls Page.reload and returns success message", async () => {
    const mockClient = createMockClient();
    const connection = createMockConnection({}, {
      getClient: vi.fn().mockResolvedValue(mockClient),
    });

    const p = handleReload({}, connection);
    await vi.runAllTimersAsync();
    const result = await p;

    expect(mockClient.Page.reload).toHaveBeenCalled();
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toBe("Page reloaded");
  });

  it("passes tabId to getClient", async () => {
    const connection = createMockConnection();
    const p = handleReload({ tabId: "tab1" }, connection);
    await vi.runAllTimersAsync();
    await p;

    expect(connection.getClient).toHaveBeenCalledWith("tab1");
  });
});
