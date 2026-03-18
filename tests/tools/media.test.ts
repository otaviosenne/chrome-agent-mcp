import { describe, it, expect, vi } from "vitest";
import type { ChromeConnection } from "../../src/core/connection.js";
import { handleScreenshot, handleSnapshot, handleEvaluate, wrapForEvaluation } from "../../src/tools/media.js";

vi.mock("../../src/utils/accessibility.js", () => ({
  formatAccessibilityTree: vi.fn().mockReturnValue("accessibility-tree-output"),
}));

function createMockClient(overrides: Partial<any> = {}): any {
  return {
    Page: {
      captureScreenshot: vi.fn().mockResolvedValue({ data: "base64imagedata" }),
      enable: vi.fn().mockResolvedValue({}),
    },
    Runtime: {
      evaluate: vi.fn().mockResolvedValue({ result: { value: "ok", type: "string" } }),
      enable: vi.fn().mockResolvedValue({}),
    },
    Accessibility: {
      getFullAXTree: vi.fn().mockResolvedValue({ nodes: [] }),
      enable: vi.fn().mockResolvedValue({}),
    },
    ...overrides,
  };
}

function createMockConnection(clientOverrides: Partial<any> = {}, connOverrides: Partial<any> = {}): ChromeConnection {
  const mockClient = createMockClient(clientOverrides);
  return {
    listTabs: vi.fn().mockResolvedValue([
      { id: "tab1", title: "Example", url: "https://example.com", type: "page", webSocketDebuggerUrl: "" },
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

describe("handleScreenshot", () => {
  it("returns image content with base64 data", async () => {
    const connection = createMockConnection();
    const result = await handleScreenshot({}, connection);

    expect(result.isError).toBeUndefined();
    expect(result.content[0].type).toBe("image");
    expect(result.content[0].data).toBe("base64imagedata");
    expect(result.content[0].mimeType).toBe("image/png");
  });

  it("calls captureScreenshot with png format", async () => {
    const mockClient = createMockClient();
    const connection = createMockConnection({}, {
      getClient: vi.fn().mockResolvedValue(mockClient),
    });

    await handleScreenshot({}, connection);

    expect(mockClient.Page.captureScreenshot).toHaveBeenCalledWith(
      expect.objectContaining({ format: "png" })
    );
  });

  it("evaluates scroll dimensions when fullPage is true", async () => {
    const mockClient = createMockClient({
      Runtime: {
        evaluate: vi.fn().mockResolvedValue({ result: { value: '{"width":1920,"height":3000}', type: "string" } }),
        enable: vi.fn().mockResolvedValue({}),
      },
    });
    const connection = createMockConnection({}, {
      getClient: vi.fn().mockResolvedValue(mockClient),
    });

    await handleScreenshot({ fullPage: true }, connection);

    expect(mockClient.Runtime.evaluate).toHaveBeenCalled();
    expect(mockClient.Page.captureScreenshot).toHaveBeenCalledWith(
      expect.objectContaining({
        clip: expect.objectContaining({ width: 1920, height: 3000 }),
      })
    );
  });

  it("passes tabId to getClient", async () => {
    const connection = createMockConnection();
    await handleScreenshot({ tabId: "tab2" }, connection);

    expect(connection.getClient).toHaveBeenCalledWith("tab2");
  });
});

describe("handleSnapshot", () => {
  it("calls Accessibility.getFullAXTree and returns text", async () => {
    const mockClient = createMockClient({
      Runtime: {
        evaluate: vi.fn().mockResolvedValue({ result: { value: "https://example.com — Example", type: "string" } }),
        enable: vi.fn().mockResolvedValue({}),
      },
    });
    const connection = createMockConnection({}, {
      getClient: vi.fn().mockResolvedValue(mockClient),
    });

    const result = await handleSnapshot({}, connection);

    expect(mockClient.Accessibility.getFullAXTree).toHaveBeenCalled();
    expect(result.isError).toBeUndefined();
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("accessibility-tree-output");
  });

  it("includes page info in snapshot output", async () => {
    const mockClient = createMockClient({
      Runtime: {
        evaluate: vi.fn().mockResolvedValue({ result: { value: "https://example.com — My Title", type: "string" } }),
        enable: vi.fn().mockResolvedValue({}),
      },
    });
    const connection = createMockConnection({}, {
      getClient: vi.fn().mockResolvedValue(mockClient),
    });

    const result = await handleSnapshot({}, connection);

    expect(result.content[0].text).toContain("https://example.com — My Title");
  });
});

describe("wrapForEvaluation", () => {
  it("leaves simple expression unwrapped", () => {
    expect(wrapForEvaluation("document.title")).toBe("document.title");
  });

  it("wraps top-level const declaration in async IIFE", () => {
    const result = wrapForEvaluation("const x = document.title; return x;");
    expect(result).toContain("async () =>");
    expect(result).toContain("const x = document.title");
  });

  it("wraps top-level let declaration in async IIFE", () => {
    const result = wrapForEvaluation("let x = 1; return x;");
    expect(result).toContain("async () =>");
  });

  it("wraps top-level var declaration in async IIFE", () => {
    const result = wrapForEvaluation("var x = 1; return x;");
    expect(result).toContain("async () =>");
  });

  it("wraps bare return statement in async IIFE", () => {
    const result = wrapForEvaluation("return document.title;");
    expect(result).toContain("async () =>");
    expect(result).toContain("return document.title");
  });

  it("does not double-wrap already-parenthesized expression", () => {
    const iife = "(() => { const x = 1; return x; })()";
    expect(wrapForEvaluation(iife)).toBe(iife);
  });

  it("does not double-wrap async IIFE", () => {
    const iife = "(async () => { return 1; })()";
    expect(wrapForEvaluation(iife)).toBe(iife);
  });

  it("wraps multiline expression with top-level const", () => {
    const expr = "const btn = document.querySelector('button');\nbtn.click();\nreturn btn.textContent;";
    const result = wrapForEvaluation(expr);
    expect(result).toContain("async () =>");
    expect(result).toContain("btn.click()");
  });
});

describe("handleEvaluate", () => {
  it("evaluates expression and returns result", async () => {
    const mockClient = createMockClient({
      Runtime: {
        evaluate: vi.fn().mockResolvedValue({ result: { value: "hello", type: "string" } }),
        enable: vi.fn().mockResolvedValue({}),
      },
    });
    const connection = createMockConnection({}, {
      getClient: vi.fn().mockResolvedValue(mockClient),
    });

    const result = await handleEvaluate({ expression: "document.title" }, connection);

    expect(mockClient.Runtime.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ expression: "document.title", returnByValue: true })
    );
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toBe("hello");
  });

  it("JSON-stringifies object results", async () => {
    const mockClient = createMockClient({
      Runtime: {
        evaluate: vi.fn().mockResolvedValue({ result: { value: { key: "val" }, type: "object" } }),
        enable: vi.fn().mockResolvedValue({}),
      },
    });
    const connection = createMockConnection({}, {
      getClient: vi.fn().mockResolvedValue(mockClient),
    });

    const result = await handleEvaluate({ expression: "({key:'val'})" }, connection);

    expect(result.content[0].text).toContain('"key"');
    expect(result.content[0].text).toContain('"val"');
  });

  it("automatically wraps top-level const expression before sending to CDP", async () => {
    const mockClient = createMockClient({
      Runtime: {
        evaluate: vi.fn().mockResolvedValue({ result: { value: "wrapped", type: "string" } }),
        enable: vi.fn().mockResolvedValue({}),
      },
    });
    const connection = createMockConnection({}, {
      getClient: vi.fn().mockResolvedValue(mockClient),
    });

    await handleEvaluate({ expression: "const x = 1; return x;" }, connection);

    const calledWith = mockClient.Runtime.evaluate.mock.calls[0][0].expression as string;
    expect(calledWith).toContain("async () =>");
    expect(calledWith).toContain("const x = 1");
  });

  it("does not wrap simple expression before sending to CDP", async () => {
    const mockClient = createMockClient({
      Runtime: {
        evaluate: vi.fn().mockResolvedValue({ result: { value: "title", type: "string" } }),
        enable: vi.fn().mockResolvedValue({}),
      },
    });
    const connection = createMockConnection({}, {
      getClient: vi.fn().mockResolvedValue(mockClient),
    });

    await handleEvaluate({ expression: "document.title" }, connection);

    const calledWith = mockClient.Runtime.evaluate.mock.calls[0][0].expression as string;
    expect(calledWith).toBe("document.title");
  });

  it("returns isError when exceptionDetails present", async () => {
    const mockClient = createMockClient({
      Runtime: {
        evaluate: vi.fn().mockResolvedValue({
          result: { type: "object" },
          exceptionDetails: {
            exception: { description: "ReferenceError: foo is not defined" },
          },
        }),
        enable: vi.fn().mockResolvedValue({}),
      },
    });
    const connection = createMockConnection({}, {
      getClient: vi.fn().mockResolvedValue(mockClient),
    });

    const result = await handleEvaluate({ expression: "foo" }, connection);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("JS Error");
    expect(result.content[0].text).toContain("ReferenceError");
  });

  it("returns generic error message when exception has no description", async () => {
    const mockClient = createMockClient({
      Runtime: {
        evaluate: vi.fn().mockResolvedValue({
          result: { type: "object" },
          exceptionDetails: { exception: {} },
        }),
        enable: vi.fn().mockResolvedValue({}),
      },
    });
    const connection = createMockConnection({}, {
      getClient: vi.fn().mockResolvedValue(mockClient),
    });

    const result = await handleEvaluate({ expression: "throw new Error()" }, connection);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Unknown error");
  });
});
