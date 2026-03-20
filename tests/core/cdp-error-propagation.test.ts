import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ChromeConnection } from "../../src/core/connection.js";
import { executeResilient } from "../../src/core/resilience.js";
import { handleScreenshot, handleSnapshot } from "../../src/tools/media.js";
import { handleNavigate } from "../../src/tools/navigation.js";
import { ToolResult } from "../../src/types.js";

vi.mock("../../src/utils/accessibility.js", () => ({
  formatAccessibilityTree: vi.fn().mockReturnValue("tree"),
}));

const CDP_CLOSED_ERROR = "WebSocket is not open: readyState 3 (CLOSED)";
const TARGET_CLOSED_ERROR = "Target closed";

function makeMockTabGroup(overrides: Partial<any> = {}): any {
  return {
    initialize: vi.fn().mockResolvedValue(undefined),
    getGroupName: vi.fn().mockReturnValue("TestGroup"),
    getGroupColor: vi.fn().mockReturnValue("blue"),
    addTab: vi.fn().mockResolvedValue(undefined),
    removeTab: vi.fn(),
    isOwned: vi.fn().mockReturnValue(true),
    hasOwnedTabs: vi.fn().mockReturnValue(true),
    getOwnedTabIds: vi.fn().mockReturnValue(new Set(["tab1"])),
    resetForNewSession: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeConnectionWithFailingClient(errorMessage: string): ChromeConnection {
  return {
    getClient: vi.fn().mockRejectedValue(new Error(errorMessage)),
    getClientForTab: vi.fn().mockRejectedValue(new Error(errorMessage)),
    listTabs: vi.fn().mockResolvedValue([]),
    newTab: vi.fn().mockResolvedValue({ id: "tab1", title: "", url: "", type: "page", webSocketDebuggerUrl: "" }),
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
    tabGroup: makeMockTabGroup(),
  } as unknown as ChromeConnection;
}

function makeConnectionWithNavigatingClient(): ChromeConnection {
  const client = {
    Page: {
      captureScreenshot: vi.fn().mockRejectedValue(new Error(TARGET_CLOSED_ERROR)),
      enable: vi.fn().mockResolvedValue({}),
    },
    Runtime: {
      evaluate: vi.fn().mockRejectedValue(new Error(TARGET_CLOSED_ERROR)),
      enable: vi.fn().mockResolvedValue({}),
    },
    Accessibility: {
      getFullAXTree: vi.fn().mockRejectedValue(new Error(TARGET_CLOSED_ERROR)),
      enable: vi.fn().mockResolvedValue({}),
    },
  };
  return {
    getClient: vi.fn().mockResolvedValue(client),
    getClientForTab: vi.fn().mockResolvedValue(client),
    listTabs: vi.fn().mockResolvedValue([]),
    newTab: vi.fn().mockResolvedValue({ id: "tab1", title: "", url: "", type: "page", webSocketDebuggerUrl: "" }),
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
    tabGroup: makeMockTabGroup(),
  } as unknown as ChromeConnection;
}

describe("CDP unavailability — tool error surfacing", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("screenshot surfaces CDP closed error after retries exhausted", async () => {
    const connection = makeConnectionWithFailingClient(CDP_CLOSED_ERROR);

    const promise = executeResilient(
      () => handleScreenshot({}, connection),
      true,
      async () => false
    );
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain(CDP_CLOSED_ERROR);
  });

  it("snapshot surfaces CDP closed error after retries exhausted", async () => {
    const connection = makeConnectionWithFailingClient(CDP_CLOSED_ERROR);

    const promise = executeResilient(
      () => handleSnapshot({}, connection),
      true,
      async () => false
    );
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain(CDP_CLOSED_ERROR);
  });

  it("navigate surfaces CDP closed error after retries exhausted", async () => {
    const connection = makeConnectionWithFailingClient(CDP_CLOSED_ERROR);

    const promise = executeResilient(
      () => handleNavigate({ url: "https://example.com" }, connection),
      false,
      async () => false
    );
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain(CDP_CLOSED_ERROR);
  });

  it("error result does not falsely claim a new group was opened when fallback was a no-op", async () => {
    const connection = makeConnectionWithFailingClient(CDP_CLOSED_ERROR);
    const noopFallback = vi.fn().mockResolvedValue(false);

    const promise = executeResilient(
      () => handleScreenshot({}, connection),
      true,
      noopFallback
    );
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.content[0].text).not.toContain("new Chrome group was opened");
  });
});

describe("Navigation mid-operation — screenshot error surfacing", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("screenshot returns isError when target closes mid-capture", async () => {
    const connection = makeConnectionWithNavigatingClient();

    const promise = executeResilient(
      () => handleScreenshot({}, connection),
      true,
      async () => false
    );
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.isError).toBe(true);
  });

  it("screenshot error text is defined and non-empty when target closes mid-capture", async () => {
    const connection = makeConnectionWithNavigatingClient();

    const promise = executeResilient(
      () => handleScreenshot({}, connection),
      true,
      async () => false
    );
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.content[0].text).toBeDefined();
    expect(result.content[0].text).not.toBe("undefined");
    expect(result.content[0].text!.length).toBeGreaterThan(0);
  });

  it("snapshot returns isError when target closes mid-snapshot", async () => {
    const connection = makeConnectionWithNavigatingClient();

    const promise = executeResilient(
      () => handleSnapshot({}, connection),
      true,
      async () => false
    );
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBeDefined();
    expect(result.content[0].text).not.toBe("undefined");
  });

  it("screenshot error includes target closed message after all retries", async () => {
    const connection = makeConnectionWithNavigatingClient();

    const promise = executeResilient(
      () => handleScreenshot({}, connection),
      true,
      async () => false
    );
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.content[0].text).toContain(TARGET_CLOSED_ERROR);
  });
});

describe("executeResilient — error propagation correctness", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("surfaces specific error text from failing fn after all retries exhausted", async () => {
    const specificMessage = "CDP session terminated: PROTOCOL_ERROR";
    const alwaysFails = vi.fn().mockRejectedValue(new Error(specificMessage));
    const onFallback = vi.fn().mockResolvedValue(false);

    const promise = executeResilient(alwaysFails, false, onFallback);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain(specificMessage);
  });

  it("returns isError true when all retries fail for idempotent operation", async () => {
    const alwaysFails = vi.fn().mockRejectedValue(new Error("any error"));
    const onFallback = vi.fn().mockResolvedValue(false);

    const promise = executeResilient(alwaysFails, true, onFallback);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.isError).toBe(true);
  });

  it("stringifies non-Error thrown values in error result", async () => {
    const alwaysFails = vi.fn().mockRejectedValue("raw string error");
    const onFallback = vi.fn().mockResolvedValue(false);

    const promise = executeResilient(alwaysFails, false, onFallback);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("raw string error");
  });

  it("does not falsely claim a new group was opened when fallback did not open one", async () => {
    const alwaysFails = vi.fn().mockRejectedValue(new Error("connection refused"));
    const noopFallback = vi.fn().mockResolvedValue(false);

    const promise = executeResilient(alwaysFails, false, noopFallback);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.isError).toBe(true);
    expect(result.content[0].text).not.toContain("new Chrome group was opened");
  });

  it("succeeds on first retry for transient failure in non-idempotent mode", async () => {
    let callCount = 0;
    const transientFail = vi.fn().mockImplementation((): Promise<ToolResult> => {
      callCount++;
      if (callCount === 1) {
        return new Promise((_, reject) =>
          setTimeout(() => reject(new Error("transient")), 25000)
        );
      }
      return Promise.resolve({ content: [{ type: "text", text: "recovered" }] });
    });
    const onFallback = vi.fn().mockResolvedValue(false);

    const promise = executeResilient(transientFail, false, onFallback);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toBe("recovered");
  });
});
