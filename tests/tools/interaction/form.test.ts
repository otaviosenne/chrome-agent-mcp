import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ChromeConnection } from "../../../src/core/connection.js";
import { handleFillForm, handleScroll } from "../../../src/tools/interaction/form.js";

function createMockConnection(mockClient: any): ChromeConnection {
  return {
    listTabs: vi.fn().mockResolvedValue([]),
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
  } as unknown as ChromeConnection;
}

describe("handleFillForm — atomic resolution", () => {
  it("does not fill any field when second element resolution fails", async () => {
    const callFunctionOn = vi.fn().mockResolvedValue({});
    const resolveNode = vi.fn()
      .mockResolvedValueOnce({ object: { objectId: "obj-1" } })
      .mockRejectedValueOnce(new Error("Element not found"));

    const mockClient = {
      DOM: { resolveNode, enable: vi.fn().mockResolvedValue({}) },
      Runtime: { callFunctionOn, evaluate: vi.fn().mockResolvedValue({ result: { value: false } }), enable: vi.fn().mockResolvedValue({}) },
      Input: { insertText: vi.fn().mockResolvedValue({}), dispatchMouseEvent: vi.fn().mockResolvedValue({}), dispatchKeyEvent: vi.fn().mockResolvedValue({}) },
    };
    const connection = createMockConnection(mockClient);

    const result = await handleFillForm({
      fields: [
        { ref: 1, value: "Alice" },
        { ref: 2, value: "alice@example.com" },
      ],
    }, connection);

    expect(result.isError).toBe(true);
    expect(mockClient.Runtime.callFunctionOn).not.toHaveBeenCalled();
  });

  it("fills all fields in order when all elements resolve", async () => {
    const callFunctionOn = vi.fn().mockResolvedValue({});
    const resolveNode = vi.fn()
      .mockResolvedValueOnce({ object: { objectId: "obj-1" } })
      .mockResolvedValueOnce({ object: { objectId: "obj-2" } });

    const mockClient = {
      DOM: { resolveNode, enable: vi.fn().mockResolvedValue({}) },
      Runtime: { callFunctionOn, evaluate: vi.fn().mockResolvedValue({ result: { value: false } }), enable: vi.fn().mockResolvedValue({}) },
      Input: { insertText: vi.fn().mockResolvedValue({}), dispatchMouseEvent: vi.fn().mockResolvedValue({}), dispatchKeyEvent: vi.fn().mockResolvedValue({}) },
    };
    const connection = createMockConnection(mockClient);

    const result = await handleFillForm({
      fields: [
        { ref: 1, value: "Alice" },
        { ref: 2, value: "alice@example.com" },
      ],
    }, connection);

    expect(result.isError).toBeUndefined();
    expect(mockClient.Runtime.callFunctionOn).toHaveBeenCalledTimes(2);
    expect(mockClient.Runtime.callFunctionOn).toHaveBeenNthCalledWith(1, expect.objectContaining({ objectId: "obj-1" }));
    expect(mockClient.Runtime.callFunctionOn).toHaveBeenNthCalledWith(2, expect.objectContaining({ objectId: "obj-2" }));
  });

  it("returns isError when element objectId is missing", async () => {
    const resolveNode = vi.fn().mockRejectedValue(new Error("Node not found"));

    const mockClient = {
      DOM: { resolveNode, enable: vi.fn().mockResolvedValue({}) },
      Runtime: { callFunctionOn: vi.fn(), evaluate: vi.fn(), enable: vi.fn().mockResolvedValue({}) },
      Input: { insertText: vi.fn(), dispatchMouseEvent: vi.fn(), dispatchKeyEvent: vi.fn() },
    };
    const connection = createMockConnection(mockClient);

    const result = await handleFillForm({
      fields: [{ ref: 99, value: "test" }],
    }, connection);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Failed to resolve form fields");
  });
});

describe("handleScroll — smooth animation", () => {
  function buildScrollClient() {
    return {
      Input: { dispatchMouseEvent: vi.fn().mockResolvedValue({}) },
      Runtime: {
        evaluate: vi.fn().mockResolvedValue({ result: { value: undefined } }),
      },
    };
  }

  it("calls Runtime.evaluate with awaitPromise", async () => {
    const mockClient = buildScrollClient();
    const connection = createMockConnection(mockClient);

    await handleScroll({ direction: "down", amount: 300 }, connection);

    expect(mockClient.Runtime.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ awaitPromise: true })
    );
  });

  it("encodes positive deltaY in expression for down direction", async () => {
    const mockClient = buildScrollClient();
    const connection = createMockConnection(mockClient);

    await handleScroll({ direction: "down", amount: 500 }, connection);

    const { expression } = mockClient.Runtime.evaluate.mock.calls[0][0];
    expect(expression).toContain("500");
    expect(expression).not.toContain("-500");
  });

  it("encodes negative deltaY for up direction", async () => {
    const mockClient = buildScrollClient();
    const connection = createMockConnection(mockClient);

    await handleScroll({ direction: "up", amount: 500 }, connection);

    const { expression } = mockClient.Runtime.evaluate.mock.calls[0][0];
    expect(expression).toContain("-500");
  });

  it("encodes deltaX for horizontal scroll", async () => {
    const mockClient = buildScrollClient();
    const connection = createMockConnection(mockClient);

    await handleScroll({ direction: "right", amount: 200 }, connection);

    const { expression } = mockClient.Runtime.evaluate.mock.calls[0][0];
    expect(expression).toContain("200");
  });

  it("uses rAF-based animation in expression", async () => {
    const mockClient = buildScrollClient();
    const connection = createMockConnection(mockClient);

    await handleScroll({ direction: "down", amount: 600 }, connection);

    const { expression } = mockClient.Runtime.evaluate.mock.calls[0][0];
    expect(expression).toContain("requestAnimationFrame");
  });

  it("returns success text", async () => {
    const mockClient = buildScrollClient();
    const connection = createMockConnection(mockClient);

    const result = await handleScroll({ direction: "up", amount: 300 }, connection);

    expect(result.content[0].text).toBe("Scrolled up by 300px");
  });
});
