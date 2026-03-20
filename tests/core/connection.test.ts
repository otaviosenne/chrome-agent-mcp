import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChromeConnection } from "../../src/core/connection.js";

type EventCallback = (params: any) => void;

const networkCallbacks = vi.hoisted(() => ({
  requestWillBeSent: null as EventCallback | null,
  responseReceived: null as EventCallback | null,
  loadingFailed: null as EventCallback | null,
  consoleAPICalled: null as EventCallback | null,
  entryAdded: null as EventCallback | null,
}));

const mockClient = vi.hoisted(() => ({
  Page: { enable: vi.fn().mockResolvedValue({}) },
  DOM: { enable: vi.fn().mockResolvedValue({}) },
  Runtime: {
    enable: vi.fn().mockResolvedValue({}),
    evaluate: vi.fn().mockResolvedValue({ result: { value: 1 } }),
    consoleAPICalled: vi.fn().mockImplementation((cb: EventCallback) => {
      networkCallbacks.consoleAPICalled = cb;
    }),
  },
  Accessibility: { enable: vi.fn().mockResolvedValue({}) },
  Log: {
    enable: vi.fn().mockResolvedValue({}),
    entryAdded: vi.fn().mockImplementation((cb: EventCallback) => {
      networkCallbacks.entryAdded = cb;
    }),
  },
  Network: {
    enable: vi.fn().mockResolvedValue({}),
    requestWillBeSent: vi.fn().mockImplementation((cb: EventCallback) => {
      networkCallbacks.requestWillBeSent = cb;
    }),
    responseReceived: vi.fn().mockImplementation((cb: EventCallback) => {
      networkCallbacks.responseReceived = cb;
    }),
    loadingFailed: vi.fn().mockImplementation((cb: EventCallback) => {
      networkCallbacks.loadingFailed = cb;
    }),
  },
  on: vi.fn(),
  close: vi.fn(),
}));

vi.mock("chrome-remote-interface", () => {
  const CDP = vi.fn().mockResolvedValue(mockClient);
  (CDP as any).List = vi.fn().mockResolvedValue([]);
  (CDP as any).New = vi.fn().mockResolvedValue({
    id: "tab1",
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
    this.getOwnedTabIds = vi.fn().mockReturnValue(new Set(["tab1"]));
    this.resetForNewSession = vi.fn().mockResolvedValue(undefined);
  });
  return { TabGroupManager: MockTabGroupManager };
});

function makeRequestSentParams(requestId: string, url: string): any {
  return {
    requestId,
    timestamp: 1000,
    request: { method: "GET", url, headers: {} },
    type: "Document",
  };
}

function makeResponseParams(requestId: string, timestamp = 1100): any {
  return {
    requestId,
    timestamp,
    response: { status: 200, statusText: "OK", headers: {} },
  };
}

describe("ChromeConnection — loadingFailed removes request from pending", () => {
  let connection: ChromeConnection;

  beforeEach(async () => {
    vi.clearAllMocks();
    networkCallbacks.requestWillBeSent = null;
    networkCallbacks.responseReceived = null;
    networkCallbacks.loadingFailed = null;
    mockClient.on.mockImplementation(() => {});
    connection = new ChromeConnection(9222);
    await connection.enableNetworkMonitoring("tab1");
  });

  it("does not add a failed request to the network log", () => {
    networkCallbacks.requestWillBeSent!(makeRequestSentParams("req-fail", "https://fail.com/"));
    networkCallbacks.loadingFailed!({ requestId: "req-fail" });

    const entry = connection.getNetworkLog("tab1").find((r) => r.requestId === "req-fail");
    expect(entry).toBeUndefined();
  });

  it("network log remains empty when all requests fail to load", () => {
    networkCallbacks.requestWillBeSent!(makeRequestSentParams("req-a", "https://a.com/"));
    networkCallbacks.requestWillBeSent!(makeRequestSentParams("req-b", "https://b.com/"));
    networkCallbacks.loadingFailed!({ requestId: "req-a" });
    networkCallbacks.loadingFailed!({ requestId: "req-b" });

    expect(connection.getNetworkLog("tab1")).toHaveLength(0);
  });
});

describe("ChromeConnection — responseReceived removes request from pending", () => {
  let connection: ChromeConnection;

  beforeEach(async () => {
    vi.clearAllMocks();
    networkCallbacks.requestWillBeSent = null;
    networkCallbacks.responseReceived = null;
    networkCallbacks.loadingFailed = null;
    mockClient.on.mockImplementation(() => {});
    connection = new ChromeConnection(9222);
    await connection.enableNetworkMonitoring("tab1");
  });

  it("logs both completed requests exactly once", () => {
    networkCallbacks.requestWillBeSent!(makeRequestSentParams("req-a", "https://a.com/"));
    networkCallbacks.requestWillBeSent!(makeRequestSentParams("req-b", "https://b.com/"));
    networkCallbacks.responseReceived!(makeResponseParams("req-a", 1200));
    networkCallbacks.responseReceived!(makeResponseParams("req-b", 1300));

    const log = connection.getNetworkLog("tab1");
    expect(log.filter((r) => r.requestId === "req-a")).toHaveLength(1);
    expect(log.filter((r) => r.requestId === "req-b")).toHaveLength(1);
  });

  it("does not log a request twice when responseReceived fires again for same requestId", () => {
    networkCallbacks.requestWillBeSent!(makeRequestSentParams("req-once", "https://once.com/"));
    networkCallbacks.responseReceived!(makeResponseParams("req-once", 1100));
    networkCallbacks.responseReceived!(makeResponseParams("req-once", 1200));

    const entries = connection.getNetworkLog("tab1").filter((r) => r.requestId === "req-once");
    expect(entries).toHaveLength(1);
  });
});

describe("ChromeConnection — closeTab clears all per-tab state", () => {
  let connection: ChromeConnection;

  beforeEach(async () => {
    vi.clearAllMocks();
    networkCallbacks.requestWillBeSent = null;
    networkCallbacks.responseReceived = null;
    networkCallbacks.consoleAPICalled = null;
    networkCallbacks.entryAdded = null;
    mockClient.on.mockImplementation(() => {});
    connection = new ChromeConnection(9222);
  });

  it("network log is empty after closeTab", async () => {
    await connection.enableNetworkMonitoring("tab1");

    networkCallbacks.requestWillBeSent!(makeRequestSentParams("req-x", "https://x.com/"));
    networkCallbacks.responseReceived!(makeResponseParams("req-x"));

    await connection.closeTab("tab1");

    expect(connection.getNetworkLog("tab1")).toEqual([]);
  });

  it("console log is empty after closeTab", async () => {
    await connection.enableConsoleMonitoring("tab1");
    await connection.closeTab("tab1");

    expect(connection.getConsoleLog("tab1")).toEqual([]);
  });

  it("mouse position resets to origin after closeTab", async () => {
    connection.setMousePosition("tab1", 400, 300);
    await connection.closeTab("tab1");

    expect(connection.getMousePosition("tab1")).toEqual({ x: 0, y: 0 });
  });
});
