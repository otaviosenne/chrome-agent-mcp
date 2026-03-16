import { describe, it, expect } from "vitest";
import { generateDescription, generateTabVerb } from "../../src/utils/description.js";

describe("generateDescription", () => {
  it("includes domain label for github.com", () => {
    const result = generateDescription("browser_navigate", { url: "https://github.com/user/repo" });
    expect(result).toContain("github");
  });

  it("does not throw for invalid URL", () => {
    expect(() => generateDescription("browser_navigate", { url: "not-a-url" })).not.toThrow();
  });

  it("does not throw for empty URL", () => {
    expect(() => generateDescription("browser_navigate", { url: "" })).not.toThrow();
  });

  it("does not throw for missing URL", () => {
    expect(() => generateDescription("browser_navigate", {})).not.toThrow();
  });

  it("result is at most 32 characters", () => {
    const result = generateDescription("browser_navigate", { url: "https://console.aws.amazon.com/s3/buckets" });
    expect(result.length).toBeLessThanOrEqual(32);
  });

  it("uses tool verb for internal chrome:// URLs", () => {
    const result = generateDescription("browser_navigate", { url: "chrome://settings" });
    expect(result).toBeTruthy();
    expect(result).not.toContain("settings");
  });

  it("uses tool verb for about: URLs", () => {
    const result = generateDescription("browser_navigate", { url: "about:blank" });
    expect(result).toBeTruthy();
  });

  it("includes domain label from tabUrl when args.url is missing", () => {
    const result = generateDescription("browser_click", {}, "https://github.com/user/repo");
    expect(result).toContain("github");
  });

  it("uses path verb for /login path", () => {
    const result = generateDescription("browser_navigate", { url: "https://github.com/login" });
    expect(result).toContain("entrando");
  });
});

describe("generateTabVerb", () => {
  it("returns non-empty string for browser_navigate", () => {
    const result = generateTabVerb("browser_navigate", {}, "https://github.com");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns non-empty string for browser_click", () => {
    const result = generateTabVerb("browser_click", {}, "https://github.com");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns non-empty string for devtools_console", () => {
    const result = generateTabVerb("devtools_console", {});
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns path verb entrando for /login path", () => {
    const result = generateTabVerb("browser_navigate", { url: "https://example.com/login" });
    expect(result).toBe("entrando");
  });

  it("returns usando as fallback for unknown tool without URL", () => {
    const result = generateTabVerb("unknown_tool", {});
    expect(result).toBe("usando");
  });

  it("uses tool verb when URL is an internal chrome:// URL", () => {
    const result = generateTabVerb("browser_navigate", { url: "chrome://newtab" });
    expect(result).toBeTruthy();
  });
});
