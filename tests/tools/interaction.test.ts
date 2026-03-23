import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ChromeConnection } from "../../src/core/connection.js";
import { handleClick, handleType, handleHover, handlePressKey } from "../../src/tools/interaction/input.js";
import { handleScroll, handleSelectOption, handleFillForm } from "../../src/tools/interaction/form.js";
import { handleWaitFor } from "../../src/tools/interaction/wait.js";

function createMockClient(overrides: Partial<any> = {}): any {
  return {
    DOM: {
      resolveNode: vi.fn().mockResolvedValue({ object: { objectId: "obj-1" } }),
      getBoxModel: vi.fn().mockResolvedValue({
        model: { content: [[0, 0], [100, 0], [100, 50], [0, 50]] },
      }),
      enable: vi.fn().mockResolvedValue({}),
    },
    Runtime: {
      callFunctionOn: vi.fn().mockResolvedValue({ result: { value: '{"x":100,"y":200}' } }),
      evaluate: vi.fn().mockResolvedValue({ result: { value: false } }),
      enable: vi.fn().mockResolvedValue({}),
    },
    Input: {
      dispatchMouseEvent: vi.fn().mockResolvedValue({}),
      dispatchKeyEvent: vi.fn().mockResolvedValue({}),
      insertText: vi.fn().mockResolvedValue({}),
    },
    ...overrides,
  };
}

function createMockConnection(clientOverrides: Partial<any> = {}, connOverrides: Partial<any> = {}): ChromeConnection {
  const mockClient = createMockClient(clientOverrides);
  return {
    listTabs: vi.fn().mockResolvedValue([
      { id: "tab1", title: "Tab", url: "https://example.com", type: "page", webSocketDebuggerUrl: "" },
    ]),
    getClient: vi.fn().mockResolvedValue(mockClient),
    getClientForTab: vi.fn().mockResolvedValue(mockClient),
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
    ...connOverrides,
  } as unknown as ChromeConnection;
}

describe("handleClick", () => {
  it("resolves element and dispatches mouse press events", async () => {
    const mockClient = createMockClient();
    const connection = createMockConnection({}, {
      getClient: vi.fn().mockResolvedValue(mockClient),
    });

    const result = await handleClick({ ref: 42 }, connection);

    expect(mockClient.DOM.resolveNode).toHaveBeenCalledWith({ backendNodeId: 42 });
    expect(mockClient.Input.dispatchMouseEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "mousePressed", button: "left" })
    );
    expect(mockClient.Input.dispatchMouseEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "mouseReleased" })
    );
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("ref=42");
  }, 10000);

  it("calls smoothMouseMove with element coordinates", async () => {
    const connection = createMockConnection();

    await handleClick({ ref: 10 }, connection);

    expect(connection.smoothMouseMove).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      100,
      200
    );
  }, 10000);

  it("performs double click when doubleClick is true", async () => {
    const mockClient = createMockClient();
    const connection = createMockConnection({}, {
      getClient: vi.fn().mockResolvedValue(mockClient),
    });

    await handleClick({ ref: 5, doubleClick: true }, connection);

    const pressEvents = mockClient.Input.dispatchMouseEvent.mock.calls.filter(
      (call: any[]) => call[0].type === "mousePressed"
    );
    expect(pressEvents.length).toBe(2);
  }, 10000);
});

describe("handleType", () => {
  it("resolves element, focuses it, and inserts text", async () => {
    const mockClient = createMockClient();
    const connection = createMockConnection({}, {
      getClient: vi.fn().mockResolvedValue(mockClient),
    });

    const result = await handleType({ ref: 7, text: "hello world" }, connection);

    expect(mockClient.DOM.resolveNode).toHaveBeenCalledWith({ backendNodeId: 7 });
    expect(mockClient.Runtime.callFunctionOn).toHaveBeenCalledWith(
      expect.objectContaining({ objectId: "obj-1" })
    );
    expect(mockClient.Input.insertText).toHaveBeenCalledWith({ text: "hello world" });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("hello world");
  });

  it("dispatches Enter key events when submit is true", async () => {
    const mockClient = createMockClient();
    const connection = createMockConnection({}, {
      getClient: vi.fn().mockResolvedValue(mockClient),
    });

    await handleType({ ref: 3, text: "search", submit: true }, connection);

    expect(mockClient.Input.dispatchKeyEvent).toHaveBeenCalledWith(
      expect.objectContaining({ key: "Enter", type: "keyDown" })
    );
    expect(mockClient.Input.dispatchKeyEvent).toHaveBeenCalledWith(
      expect.objectContaining({ key: "Enter", type: "keyUp" })
    );
  });

  it("does not dispatch Enter when submit is false", async () => {
    const mockClient = createMockClient();
    const connection = createMockConnection({}, {
      getClient: vi.fn().mockResolvedValue(mockClient),
    });

    await handleType({ ref: 3, text: "search", submit: false }, connection);

    expect(mockClient.Input.dispatchKeyEvent).not.toHaveBeenCalled();
  });
});

describe("handleHover", () => {
  it("resolves element center and calls smoothMouseMove", async () => {
    const connection = createMockConnection();

    const result = await handleHover({ ref: 15 }, connection);

    expect(connection.smoothMouseMove).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      100,
      200
    );
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("ref=15");
  });
});

describe("handlePressKey", () => {
  it("dispatches keyDown and keyUp events for the given key", async () => {
    const mockClient = createMockClient();
    const connection = createMockConnection({}, {
      getClient: vi.fn().mockResolvedValue(mockClient),
    });

    const result = await handlePressKey({ key: "Enter" }, connection);

    expect(mockClient.Input.dispatchKeyEvent).toHaveBeenCalledWith({ type: "keyDown", key: "Enter" });
    expect(mockClient.Input.dispatchKeyEvent).toHaveBeenCalledWith({ type: "keyUp", key: "Enter" });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Enter");
  });

  it("passes tabId to getClient", async () => {
    const connection = createMockConnection();

    await handlePressKey({ key: "Escape", tabId: "tab2" }, connection);

    expect(connection.getClient).toHaveBeenCalledWith("tab2");
  });
});

function sumScrollDelta(calls: any[][], axis: "deltaX" | "deltaY"): number {
  return calls.reduce((s, c) => s + (c[0][axis] ?? 0), 0);
}

describe("handleScroll", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("dispatches 20 mouseWheel events for down direction summing to 300", async () => {
    const mockClient = createMockClient();
    const connection = createMockConnection({}, {
      getClient: vi.fn().mockResolvedValue(mockClient),
    });

    const promise = handleScroll({ direction: "down" }, connection);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(mockClient.Input.dispatchMouseEvent).toHaveBeenCalledTimes(20);
    mockClient.Input.dispatchMouseEvent.mock.calls.forEach((call: any[]) => {
      expect(call[0].type).toBe("mouseWheel");
    });
    expect(sumScrollDelta(mockClient.Input.dispatchMouseEvent.mock.calls, "deltaY")).toBeCloseTo(300, 0);
    expect(result.content[0].text).toContain("down");
    expect(result.content[0].text).toContain("300");
  });

  it("scrolls up with negative deltaY summing to -500", async () => {
    const mockClient = createMockClient();
    const connection = createMockConnection({}, {
      getClient: vi.fn().mockResolvedValue(mockClient),
    });

    const promise = handleScroll({ direction: "up", amount: 500 }, connection);
    await vi.runAllTimersAsync();
    await promise;

    expect(sumScrollDelta(mockClient.Input.dispatchMouseEvent.mock.calls, "deltaY")).toBeCloseTo(-500, 0);
  });

  it("coerces string amount to number", async () => {
    const mockClient = createMockClient();
    const connection = createMockConnection({}, {
      getClient: vi.fn().mockResolvedValue(mockClient),
    });

    const promise = handleScroll({ direction: "down", amount: "500" as unknown as number }, connection);
    await vi.runAllTimersAsync();
    await promise;

    expect(sumScrollDelta(mockClient.Input.dispatchMouseEvent.mock.calls, "deltaY")).toBeCloseTo(500, 0);
  });

  it("falls back to 300 when amount is NaN", async () => {
    const mockClient = createMockClient();
    const connection = createMockConnection({}, {
      getClient: vi.fn().mockResolvedValue(mockClient),
    });

    const promise = handleScroll({ direction: "down", amount: "notanumber" as unknown as number }, connection);
    await vi.runAllTimersAsync();
    await promise;

    expect(sumScrollDelta(mockClient.Input.dispatchMouseEvent.mock.calls, "deltaY")).toBeCloseTo(300, 0);
  });

  it("uses element center for all dispatched events when ref is provided", async () => {
    const mockClient = createMockClient();
    const connection = createMockConnection({}, {
      getClient: vi.fn().mockResolvedValue(mockClient),
    });

    const promise = handleScroll({ direction: "down", ref: 20 }, connection);
    await vi.runAllTimersAsync();
    await promise;

    expect(mockClient.DOM.resolveNode).toHaveBeenCalled();
    mockClient.Input.dispatchMouseEvent.mock.calls.forEach((call: any[]) => {
      expect(call[0]).toMatchObject({ x: 100, y: 200 });
    });
  });
});

describe("handleSelectOption", () => {
  it("resolves element and sets value via callFunctionOn", async () => {
    const mockClient = createMockClient();
    const connection = createMockConnection({}, {
      getClient: vi.fn().mockResolvedValue(mockClient),
    });

    const result = await handleSelectOption({ ref: 8, value: "option-a" }, connection);

    expect(mockClient.DOM.resolveNode).toHaveBeenCalledWith({ backendNodeId: 8 });
    expect(mockClient.Runtime.callFunctionOn).toHaveBeenCalledWith(
      expect.objectContaining({
        objectId: "obj-1",
        arguments: [{ value: "option-a" }],
      })
    );
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("option-a");
  });
});

describe("handleFillForm", () => {
  it("fills each field via callFunctionOn", async () => {
    const mockClient = createMockClient();
    const connection = createMockConnection({}, {
      getClient: vi.fn().mockResolvedValue(mockClient),
    });

    const result = await handleFillForm({
      fields: [
        { ref: 1, value: "Alice" },
        { ref: 2, value: "alice@example.com" },
      ],
    }, connection);

    expect(mockClient.DOM.resolveNode).toHaveBeenCalledTimes(2);
    expect(mockClient.Runtime.callFunctionOn).toHaveBeenCalledTimes(2);
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("2 form field");
  });

  it("reports correct count for single field", async () => {
    const connection = createMockConnection();
    const result = await handleFillForm({ fields: [{ ref: 1, value: "test" }] }, connection);

    expect(result.content[0].text).toContain("1 form field");
  });
});

describe("handleWaitFor", () => {
  it("returns success when text is found on page", async () => {
    const mockClient = createMockClient({
      Runtime: {
        evaluate: vi.fn().mockResolvedValue({ result: { value: true } }),
        enable: vi.fn().mockResolvedValue({}),
      },
    });
    const connection = createMockConnection({}, {
      getClient: vi.fn().mockResolvedValue(mockClient),
    });

    const result = await handleWaitFor({ text: "Hello World" }, connection);

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Hello World");
    expect(result.content[0].text).toContain("Text found");
  });

  it("returns isError after timeout when text is never found", async () => {
    const mockClient = createMockClient({
      Runtime: {
        evaluate: vi.fn().mockResolvedValue({ result: { value: false } }),
        enable: vi.fn().mockResolvedValue({}),
      },
    });
    const connection = createMockConnection({}, {
      getClient: vi.fn().mockResolvedValue(mockClient),
    });

    const result = await handleWaitFor({ text: "never-appears" }, connection);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Timeout");
    expect(result.content[0].text).toContain("never-appears");
  }, 15000);

  it("waits fixed duration when no text is provided", async () => {
    const connection = createMockConnection();
    const start = Date.now();
    const result = await handleWaitFor({ time: 0.1 }, connection);
    const elapsed = Date.now() - start;

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("0.1s");
    expect(elapsed).toBeGreaterThanOrEqual(80);
  });
});
