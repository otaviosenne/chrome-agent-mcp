import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChromeConnection } from "../../src/core/connection.js";

const mockClient = vi.hoisted(() => ({
  Page: { enable: vi.fn().mockResolvedValue({}) },
  DOM: { enable: vi.fn().mockResolvedValue({}) },
  Runtime: {
    enable: vi.fn().mockResolvedValue({}),
    evaluate: vi.fn().mockResolvedValue({ result: { value: 1 } }),
  },
  Accessibility: { enable: vi.fn().mockResolvedValue({}) },
  on: vi.fn(),
}));

vi.mock("chrome-remote-interface", () => {
  const CDP = vi.fn().mockResolvedValue(mockClient);
  (CDP as any).List = vi.fn().mockResolvedValue([
    { id: "tab1", type: "page", title: "Tab One", url: "https://example.com", webSocketDebuggerUrl: "" },
    { id: "tab2", type: "page", title: "Tab Two", url: "https://other.com", webSocketDebuggerUrl: "" },
  ]);
  (CDP as any).New = vi.fn().mockResolvedValue({
    id: "tab-new",
    type: "page",
    title: "",
    url: "about:blank",
    webSocketDebuggerUrl: "",
  });
  (CDP as any).Close = vi.fn().mockResolvedValue({});
  return { default: CDP };
});

vi.mock("../../src/core/groups/manager.js", () => {
  const MockTabGroupManager = vi.fn().mockImplementation(function (this: any) {
    this.initialize = vi.fn().mockResolvedValue(undefined);
    this.getGroupName = vi.fn().mockReturnValue("TestGroup");
    this.getGroupColor = vi.fn().mockReturnValue("blue");
    this.addTab = vi.fn().mockResolvedValue(undefined);
    this.removeTab = vi.fn();
    this.isOwned = vi.fn().mockReturnValue(true);
    this.hasOwnedTabs = vi.fn().mockReturnValue(true);
    this.getOwnedTabIds = vi.fn().mockReturnValue(new Set(["tab1", "tab2"]));
    this.resetForNewSession = vi.fn().mockResolvedValue(undefined);
  });
  return { TabGroupManager: MockTabGroupManager };
});

describe("ChromeConnection — tab targeting after explicit tabId", () => {
  let connection: ChromeConnection;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.on.mockImplementation(() => {});
    connection = new ChromeConnection(9222);
    connection.setActiveTab("tab1");
  });

  it("updates activeTabId when getClient is called with an explicit tabId", async () => {
    expect(connection.getActiveTabId()).toBe("tab1");

    await connection.getClient("tab2");

    expect(connection.getActiveTabId()).toBe("tab2");
  });

  it("subsequent call without tabId targets the last explicitly-used tab", async () => {
    await connection.getClient("tab2");
    expect(connection.getActiveTabId()).toBe("tab2");

    await connection.getClient();

    expect(connection.getActiveTabId()).toBe("tab2");
  });

  it("does not change activeTabId when called without a tabId and active tab is already set", async () => {
    connection.setActiveTab("tab1");

    await connection.getClient();

    expect(connection.getActiveTabId()).toBe("tab1");
  });

  it("switching tabs with setActiveTab then getClient with explicit tabId updates activeTabId", async () => {
    connection.setActiveTab("tab1");
    expect(connection.getActiveTabId()).toBe("tab1");

    await connection.getClient("tab2");

    expect(connection.getActiveTabId()).toBe("tab2");
  });
});

describe("ChromeConnection — activeTabId cleared on disconnect", () => {
  it("clears activeTabId when the active tab disconnects", async () => {
    let disconnectHandler: (() => void) | null = null;
    mockClient.on.mockImplementation((event: string, handler: () => void) => {
      if (event === "disconnect") disconnectHandler = handler;
    });

    const conn = new ChromeConnection(9222);
    conn.setActiveTab("tab1");
    await conn.getClientForTab("tab1");

    expect(conn.getActiveTabId()).toBe("tab1");

    disconnectHandler!();

    expect(conn.getActiveTabId()).toBeNull();
  });
});
