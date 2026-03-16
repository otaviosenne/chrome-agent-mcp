import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { executeResilient } from "../../src/core/resilience.js";
import { ToolResult } from "../../src/types.js";

const SUCCESS_RESULT: ToolResult = {
  content: [{ type: "text", text: "ok" }],
};

function makeSuccessFn(): () => Promise<ToolResult> {
  return vi.fn().mockResolvedValue(SUCCESS_RESULT);
}

function makeNeverResolvingFn(): () => Promise<ToolResult> {
  return vi.fn().mockImplementation(() => new Promise(() => {}));
}

function makeFailingFn(message = "fail"): () => Promise<ToolResult> {
  return vi.fn().mockRejectedValue(new Error(message));
}

describe("executeResilient - happy path", () => {
  it("returns result immediately when fn resolves within timeout", async () => {
    const fn = makeSuccessFn();
    const onFallback = vi.fn().mockResolvedValue(undefined);

    const result = await executeResilient(fn, true, onFallback);

    expect(result).toEqual(SUCCESS_RESULT);
    expect(onFallback).not.toHaveBeenCalled();
  });

  it("calls fn exactly once on success", async () => {
    const fn = makeSuccessFn();
    const onFallback = vi.fn().mockResolvedValue(undefined);

    await executeResilient(fn, false, onFallback);

    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("executeResilient - fallback path", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls onFallback when all retries fail", async () => {
    const fn = makeFailingFn("timeout");
    const onFallback = vi.fn().mockResolvedValue(undefined);
    const successAfterFallback = vi.fn().mockResolvedValue(SUCCESS_RESULT);

    let callCount = 0;
    const adaptiveFn = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount <= 3) return Promise.reject(new Error("fail"));
      return Promise.resolve(SUCCESS_RESULT);
    });

    const promise = executeResilient(adaptiveFn, false, onFallback);
    await vi.runAllTimersAsync();
    await promise;

    expect(onFallback).toHaveBeenCalled();
  });

  it("returns isError result when fallback fn also fails", async () => {
    const fn = makeFailingFn("primary fail");
    const onFallback = vi.fn().mockResolvedValue(undefined);

    const alwaysFails = vi.fn().mockRejectedValue(new Error("always fails"));

    const promise = executeResilient(alwaysFails, false, onFallback);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("All attempts failed");
  });

  it("error result includes last error message", async () => {
    const alwaysFails = vi.fn().mockRejectedValue(new Error("specific error message"));
    const onFallback = vi.fn().mockResolvedValue(undefined);

    const promise = executeResilient(alwaysFails, false, onFallback);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.content[0].text).toContain("specific error message");
  });
});

describe("executeResilient - idempotent mode", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns success when second attempt resolves for idempotent fn", async () => {
    let callCount = 0;
    const fn = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return new Promise<ToolResult>(() => {});
      return Promise.resolve(SUCCESS_RESULT);
    });

    const primaryWrapper = vi.fn().mockImplementation(() => {
      if (callCount === 0) {
        callCount++;
        return new Promise<ToolResult>(() => {});
      }
      return Promise.resolve(SUCCESS_RESULT);
    });

    const onFallback = vi.fn().mockResolvedValue(undefined);

    let firstCall = true;
    const smartFn = vi.fn().mockImplementation(() => {
      if (firstCall) {
        firstCall = false;
        return new Promise<ToolResult>((_, reject) => setTimeout(() => reject(new Error("timeout")), 25000));
      }
      return Promise.resolve(SUCCESS_RESULT);
    });

    const promise = executeResilient(smartFn, true, onFallback);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toEqual(SUCCESS_RESULT);
  });
});

describe("executeResilient - sequential retry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("succeeds on second sequential attempt", async () => {
    let callCount = 0;
    const fn = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount <= 1) return new Promise<ToolResult>((_, reject) => setTimeout(() => reject(new Error("timeout")), 25000));
      return Promise.resolve(SUCCESS_RESULT);
    });

    const onFallback = vi.fn().mockResolvedValue(undefined);

    const promise = executeResilient(fn, false, onFallback);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toEqual(SUCCESS_RESULT);
  });
});
