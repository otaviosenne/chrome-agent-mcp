const PRIMARY_TIMEOUT_MS = 20_000;
const RETRY_TIMEOUT_MS = 10_000;
class TimeoutError extends Error {
    constructor(ms) {
        super(`Operation timed out after ${ms}ms`);
        this.name = "TimeoutError";
    }
}
function withTimeout(promise, ms) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new TimeoutError(ms)), ms)),
    ]);
}
function raceParallelAttempts(fn, count, timeoutMs) {
    const attempts = Array.from({ length: count }, () => withTimeout(fn(), timeoutMs));
    return Promise.any(attempts);
}
async function sequentialRetry(fn, count, timeoutMs) {
    let lastError;
    for (let i = 0; i < count; i++) {
        try {
            return await withTimeout(fn(), timeoutMs);
        }
        catch (e) {
            lastError = e;
        }
    }
    throw lastError;
}
function buildErrorResult(message, fallbackOpened) {
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
export async function executeResilient(fn, isIdempotent, onFallback) {
    try {
        return await withTimeout(fn(), PRIMARY_TIMEOUT_MS);
    }
    catch {
        try {
            return isIdempotent
                ? await raceParallelAttempts(fn, 2, RETRY_TIMEOUT_MS)
                : await sequentialRetry(fn, 2, RETRY_TIMEOUT_MS);
        }
        catch {
            let fallbackOpened = false;
            try {
                fallbackOpened = await onFallback();
                return await withTimeout(fn(), RETRY_TIMEOUT_MS);
            }
            catch (finalError) {
                const message = finalError instanceof Error ? finalError.message : String(finalError);
                return buildErrorResult(message, fallbackOpened);
            }
        }
    }
}
export async function openFallbackGroup(connection) {
    connection.tabGroup.resetForNewSession();
    await connection.tabGroup.initialize();
    return true;
}
