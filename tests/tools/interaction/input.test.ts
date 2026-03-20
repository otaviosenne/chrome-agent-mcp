import { describe, it, expect, vi } from "vitest";
import type { ChromeConnection } from "../../../src/core/connection.js";
import { handleClick, handleHover, handleType } from "../../../src/tools/interaction/input.js";

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

function createMockConnection(
  clientOverrides: Partial<any> = {},
  connOverrides: Partial<any> = {}
): ChromeConnection {
  const mockClient = createMockClient(clientOverrides);
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
    ...connOverrides,
  } as unknown as ChromeConnection;
}

describe("handleClick — visibility guard", () => {
  it("rejects hidden element when getBoxModel throws", async () => {
    const mockClient = createMockClient({
      DOM: {
        resolveNode: vi.fn().mockResolvedValue({ object: { objectId: "obj-1" } }),
        getBoxModel: vi.fn().mockRejectedValue(new Error("Node not found")),
        enable: vi.fn().mockResolvedValue({}),
      },
    });
    const connection = createMockConnection({}, {
      getClient: vi.fn().mockResolvedValue(mockClient),
    });

    await expect(handleClick({ ref: 99 }, connection)).rejects.toThrow(/not visible/i);
  }, 10000);

  it("succeeds for visible element and dispatches mouse events", async () => {
    const mockClient = createMockClient();
    const connection = createMockConnection({}, {
      getClient: vi.fn().mockResolvedValue(mockClient),
    });

    const result = await handleClick({ ref: 42 }, connection);

    expect(mockClient.DOM.getBoxModel).toHaveBeenCalledWith({ backendNodeId: 42 });
    expect(mockClient.Input.dispatchMouseEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "mousePressed", button: "left" })
    );
    expect(mockClient.Input.dispatchMouseEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "mouseReleased" })
    );
    expect(result.isError).toBeUndefined();
  }, 10000);
});

describe("handleHover — visibility guard", () => {
  it("rejects hidden element when getBoxModel throws", async () => {
    const mockClient = createMockClient({
      DOM: {
        resolveNode: vi.fn().mockResolvedValue({ object: { objectId: "obj-1" } }),
        getBoxModel: vi.fn().mockRejectedValue(new Error("Node not found")),
        enable: vi.fn().mockResolvedValue({}),
      },
    });
    const connection = createMockConnection({}, {
      getClient: vi.fn().mockResolvedValue(mockClient),
    });

    await expect(handleHover({ ref: 55 }, connection)).rejects.toThrow(/not visible/i);
  });
});

describe("handleType — text guard", () => {
  it("returns isError when text is undefined", async () => {
    const connection = createMockConnection();

    const result = await handleType({ ref: 1, text: undefined }, connection);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("text argument is required");
  });

  it("returns isError when text is null", async () => {
    const connection = createMockConnection();

    const result = await handleType({ ref: 1, text: null }, connection);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("text argument is required");
  });
});
