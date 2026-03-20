import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TabFaviconManager } from "../../src/core/favicon.js";
import type { ChromeConnection } from "../../src/core/connection.js";

const STOP_SCRIPT_MARKER = "window.__cf = false";
const START_SCRIPT_MARKER = "window.__cf = true";

function makeEvaluateSpy(): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({ result: {} });
}

function makeConnection(evaluateFn = makeEvaluateSpy()): ChromeConnection {
  const client = { Runtime: { evaluate: evaluateFn } };
  return {
    clearClientForTab: vi.fn(),
    getClientForTab: vi.fn().mockResolvedValue(client),
  } as unknown as ChromeConnection;
}

describe("TabFaviconManager — markDone calls stopActivity", () => {
  let manager: TabFaviconManager;

  beforeEach(() => {
    manager = new TabFaviconManager();
  });

  it("calls clearClientForTab before getClientForTab", async () => {
    const callOrder: string[] = [];
    const connection = {
      clearClientForTab: vi.fn().mockImplementation(() => callOrder.push("clear")),
      getClientForTab: vi.fn().mockImplementation(async () => {
        callOrder.push("get");
        return { Runtime: { evaluate: vi.fn().mockResolvedValue({ result: {} }) } };
      }),
    } as unknown as ChromeConnection;

    await manager.markDone("tab1", connection);

    expect(callOrder).toEqual(["clear", "get"]);
  });

  it("evaluates STOP_SCRIPT after clearClientForTab", async () => {
    const evaluate = makeEvaluateSpy();
    const connection = makeConnection(evaluate);

    await manager.markDone("tab1", connection);

    const expressions: string[] = evaluate.mock.calls.map((c: any[]) => c[0].expression as string);
    const stopCall = expressions.find((e) => e.includes(STOP_SCRIPT_MARKER));
    expect(stopCall).toBeDefined();
  });

  it("clears the client exactly once per markDone call", async () => {
    const connection = makeConnection();

    await manager.markDone("tab1", connection);

    expect((connection.clearClientForTab as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });
});

describe("TabFaviconManager — stopActivity forces fresh connection", () => {
  let manager: TabFaviconManager;

  beforeEach(() => {
    manager = new TabFaviconManager();
  });

  it("calls clearClientForTab before getClientForTab", async () => {
    const callOrder: string[] = [];
    const connection = {
      clearClientForTab: vi.fn().mockImplementation(() => callOrder.push("clear")),
      getClientForTab: vi.fn().mockImplementation(async () => {
        callOrder.push("get");
        return { Runtime: { evaluate: vi.fn().mockResolvedValue({ result: {} }) } };
      }),
    } as unknown as ChromeConnection;

    await manager.stopActivity("tab1", connection);

    expect(callOrder[0]).toBe("clear");
    expect(callOrder[1]).toBe("get");
  });

  it("always gets a fresh client even when called standalone", async () => {
    const connection = makeConnection();

    await manager.stopActivity("tab1", connection);

    expect((connection.clearClientForTab as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
    expect((connection.getClientForTab as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });
});

describe("TabFaviconManager — startActivityAfterLoad aborts when markDone called during load", () => {
  let manager: TabFaviconManager;

  beforeEach(() => {
    manager = new TabFaviconManager();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not evaluate START_SCRIPT a second time after abort", async () => {
    const evaluate = makeEvaluateSpy();
    let domFiredCallback: (() => void) | null = null;

    const client = {
      Runtime: { evaluate },
      Page: {
        domContentEventFired: vi.fn().mockImplementation((cb: () => void) => {
          domFiredCallback = cb;
        }),
      },
    };

    const connection = {
      clearClientForTab: vi.fn(),
      getClientForTab: vi.fn().mockResolvedValue(client),
    } as unknown as ChromeConnection;

    const loadPromise = manager.startActivityAfterLoad("tab1", connection);

    await manager.markDone("tab1", connection);

    domFiredCallback!();
    await vi.runAllTimersAsync();
    await loadPromise;

    const startCalls = evaluate.mock.calls.filter((c: any[]) =>
      (c[0].expression as string).includes(START_SCRIPT_MARKER)
    );
    expect(startCalls).toHaveLength(1);
  });

  it("evaluates STOP_SCRIPT when markDone is called during load", async () => {
    const evaluate = makeEvaluateSpy();
    let domFiredCallback: (() => void) | null = null;

    const client = {
      Runtime: { evaluate },
      Page: {
        domContentEventFired: vi.fn().mockImplementation((cb: () => void) => {
          domFiredCallback = cb;
        }),
      },
    };

    const stopClient = { Runtime: { evaluate: makeEvaluateSpy() } };
    let getCallCount = 0;
    const connection = {
      clearClientForTab: vi.fn(),
      getClientForTab: vi.fn().mockImplementation(async () => {
        getCallCount++;
        return getCallCount === 1 ? client : stopClient;
      }),
    } as unknown as ChromeConnection;

    const loadPromise = manager.startActivityAfterLoad("tab1", connection);

    await manager.markDone("tab1", connection);

    domFiredCallback!();
    await vi.runAllTimersAsync();
    await loadPromise;

    const stopExpressions = (stopClient.Runtime.evaluate as ReturnType<typeof vi.fn>).mock.calls
      .map((c: any[]) => c[0].expression as string)
      .filter((e) => e.includes(STOP_SCRIPT_MARKER));
    expect(stopExpressions.length).toBeGreaterThanOrEqual(1);
  });
});
