import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ChromeConnection } from "../../src/core/connection.js";

vi.mock("chrome-remote-interface", () => ({
  default: {
    List: vi.fn(),
  },
}));

import CDP from "chrome-remote-interface";
import { handleChromeWindows, handleChromeFocus, handleChromeExtensions } from "../../src/tools/browser.js";

function createMockClient(overrides: Partial<any> = {}): any {
  return {
    Target: { activateTarget: vi.fn().mockResolvedValue({}) },
    Runtime: { evaluate: vi.fn().mockResolvedValue({ result: { value: "ok" } }) },
    ...overrides,
  };
}

function createMockConnection(overrides: Partial<any> = {}): ChromeConnection {
  const mockClient = createMockClient();
  return {
    listTabs: vi.fn().mockResolvedValue([
      { id: "tab1", title: "Tab One", url: "https://example.com", type: "page", webSocketDebuggerUrl: "" },
      { id: "tab2", title: "Tab Two", url: "https://other.com", type: "page", webSocketDebuggerUrl: "" },
    ]),
    getClient: vi.fn().mockResolvedValue(mockClient),
    getClientForTab: vi.fn().mockResolvedValue(mockClient),
    newTab: vi.fn().mockResolvedValue({ id: "tab3", title: "New Tab", url: "about:blank", type: "page", webSocketDebuggerUrl: "" }),
    closeTab: vi.fn().mockResolvedValue(undefined),
    setActiveTab: vi.fn(),
    getActiveTabId: vi.fn().mockReturnValue("tab1"),
    tabGroup: {
      getGroupName: vi.fn().mockReturnValue("Test"),
      hasOwnedTabs: vi.fn().mockReturnValue(true),
      getOwnedTabIds: vi.fn().mockReturnValue(new Set(["tab1"])),
    },
    ...overrides,
  } as unknown as ChromeConnection;
}

beforeEach(() => {
  vi.clearAllMocks();
  (CDP as any).List = vi.fn().mockResolvedValue([
    { id: "tab1", type: "page", title: "Tab One", url: "https://example.com" },
    { id: "tab2", type: "page", title: "Tab Two", url: "https://other.com" },
  ]);
});

describe("handleChromeWindows", () => {
  it("returns formatted tab list on list action", async () => {
    const connection = createMockConnection();

    const result = await handleChromeWindows({ action: "list" }, connection);

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("tab1");
    expect(result.content[0].text).toContain("Tab One");
  });

  it("includes tab count in header", async () => {
    const connection = createMockConnection();

    const result = await handleChromeWindows({ action: "list" }, connection);

    expect(result.content[0].text).toContain("2 total");
  });

  it("returns error for unknown action", async () => {
    const connection = createMockConnection();

    const result = await handleChromeWindows({ action: "unknown" }, connection);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Unknown action");
  });

  it("calls connection.listTabs", async () => {
    const connection = createMockConnection();

    await handleChromeWindows({ action: "list" }, connection);

    expect(connection.listTabs).toHaveBeenCalled();
  });
});

describe("handleChromeFocus", () => {
  it("focuses tab via Target.activateTarget", async () => {
    const mockClient = createMockClient();
    const connection = createMockConnection({
      getClientForTab: vi.fn().mockResolvedValue(mockClient),
    });

    const result = await handleChromeFocus({ tabId: "tab1" }, connection);

    expect(mockClient.Target.activateTarget).toHaveBeenCalledWith({ targetId: "tab1" });
    expect(result.content[0].text).toContain("tab1");
  });

  it("falls back to window.focus() when activateTarget fails", async () => {
    const mockClient = createMockClient({
      Target: { activateTarget: vi.fn().mockRejectedValue(new Error("not supported")) },
      Runtime: { evaluate: vi.fn().mockResolvedValue({ result: {} }) },
    });
    const connection = createMockConnection({
      getClientForTab: vi.fn().mockResolvedValue(mockClient),
    });

    const result = await handleChromeFocus({ tabId: "tab1" }, connection);

    expect(mockClient.Runtime.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ expression: "window.focus()" })
    );
    expect(result.content[0].text).toContain("Focused tab");
  });
});

describe("handleChromeExtensions", () => {
  it("returns extensions when found", async () => {
    (CDP as any).List = vi.fn().mockResolvedValue([
      { type: "service_worker", title: "My Extension", url: "chrome-extension://abc/bg.js" },
      { type: "page", title: "Tab", url: "https://example.com" },
    ]);

    const connection = createMockConnection();
    const result = await handleChromeExtensions({}, connection);

    expect(result.content[0].text).toContain("My Extension");
    expect(result.content[0].text).toContain("1");
  });

  it("returns no-extensions message when none found", async () => {
    (CDP as any).List = vi.fn().mockResolvedValue([
      { type: "page", title: "Tab", url: "https://example.com" },
    ]);

    const connection = createMockConnection();
    const result = await handleChromeExtensions({}, connection);

    expect(result.content[0].text).toContain("No extensions");
  });
});
