import { ToolResult } from "../types.js";
import { ChromeConnection } from "./connection.js";

const PRIMARY_TIMEOUT_MS = 20_000;
const RETRY_TIMEOUT_MS = 10_000;

class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Operation timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new TimeoutError(ms)), ms)
    ),
  ]);
}

function raceParallelAttempts(
  fn: () => Promise<ToolResult>,
  count: number,
  timeoutMs: number
): Promise<ToolResult> {
  const attempts = Array.from({ length: count }, () => withTimeout(fn(), timeoutMs));
  return Promise.any(attempts);
}

async function sequentialRetry(
  fn: () => Promise<ToolResult>,
  count: number,
  timeoutMs: number
): Promise<ToolResult> {
  let lastError: unknown;
  for (let i = 0; i < count; i++) {
    try {
      return await withTimeout(fn(), timeoutMs);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

function buildErrorResult(message: string, fallbackOpened: boolean): ToolResult {
  const hint = fallbackOpened
    ? "A new Chrome group was opened — please retry your action in the new group."
    : "Please retry your action or check that Chrome is still running.";
  return {
    content: [{
      type: "text",
      text: `All attempts failed. ${hint}\nLast error: ${message}`,
    }],
    isError: true,
  };
}

export async function executeResilient(
  fn: () => Promise<ToolResult>,
  isIdempotent: boolean,
  onFallback: () => Promise<boolean>
): Promise<ToolResult> {
  try {
    return await withTimeout(fn(), PRIMARY_TIMEOUT_MS);
  } catch {
    try {
      return isIdempotent
        ? await raceParallelAttempts(fn, 2, RETRY_TIMEOUT_MS)
        : await sequentialRetry(fn, 2, RETRY_TIMEOUT_MS);
    } catch {
      let fallbackOpened = false;
      try {
        fallbackOpened = await onFallback();
        return await withTimeout(fn(), RETRY_TIMEOUT_MS);
      } catch (finalError) {
        const message = finalError instanceof Error ? finalError.message : String(finalError);
        return buildErrorResult(message, fallbackOpened);
      }
    }
  }
}

export async function openFallbackGroup(connection: ChromeConnection): Promise<boolean> {
  connection.tabGroup.resetForNewSession();
  await connection.tabGroup.initialize();
  return true;
}
