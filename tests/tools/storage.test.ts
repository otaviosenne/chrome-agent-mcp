import { describe, it, expect, vi } from "vitest";
import type { ChromeConnection } from "../../src/core/connection.js";
import { handleDevtoolsStorage } from "../../src/tools/devtools/storage.js";

function createMockClient(evaluateValue: any = "{}", networkOverrides: Partial<any> = {}): any {
  return {
    Runtime: {
      evaluate: vi.fn().mockResolvedValue({ result: { value: evaluateValue } }),
    },
    Network: {
      getCookies: vi.fn().mockResolvedValue({ cookies: [] }),
      setCookie: vi.fn().mockResolvedValue({}),
      deleteCookies: vi.fn().mockResolvedValue({}),
      ...networkOverrides,
    },
  };
}

function createMockConnection(clientOverrides: Partial<any> = {}): ChromeConnection {
  const mockClient = createMockClient(clientOverrides.evaluateValue, clientOverrides.network);
  return {
    getClient: vi.fn().mockResolvedValue(mockClient),
    ...clientOverrides,
    _mockClient: mockClient,
  } as unknown as ChromeConnection;
}

describe("handleDevtoolsStorage - localStorage", () => {
  it("lists all localStorage keys", async () => {
    const mockClient = createMockClient(JSON.stringify({ key1: "val1", key2: "val2" }));
    const connection = { getClient: vi.fn().mockResolvedValue(mockClient) } as unknown as ChromeConnection;

    const result = await handleDevtoolsStorage({ storageType: "localStorage", action: "list" }, connection);

    expect(result.content[0].text).toContain("key1");
    expect(result.content[0].text).toContain("val1");
    expect(result.content[0].text).toContain("2 keys");
  });

  it("returns empty message when localStorage is empty", async () => {
    const mockClient = createMockClient("{}");
    const connection = { getClient: vi.fn().mockResolvedValue(mockClient) } as unknown as ChromeConnection;

    const result = await handleDevtoolsStorage({ storageType: "localStorage", action: "list" }, connection);

    expect(result.content[0].text).toContain("empty");
  });

  it("gets a specific key", async () => {
    const mockClient = createMockClient("myValue");
    const connection = { getClient: vi.fn().mockResolvedValue(mockClient) } as unknown as ChromeConnection;

    const result = await handleDevtoolsStorage({ storageType: "localStorage", action: "get", key: "myKey" }, connection);

    expect(result.content[0].text).toContain("myKey");
    expect(result.content[0].text).toContain("myValue");
  });

  it("returns error when get missing key argument", async () => {
    const mockClient = createMockClient();
    const connection = { getClient: vi.fn().mockResolvedValue(mockClient) } as unknown as ChromeConnection;

    const result = await handleDevtoolsStorage({ storageType: "localStorage", action: "get" }, connection);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("key is required");
  });

  it("sets a key-value pair", async () => {
    const mockClient = createMockClient();
    const connection = { getClient: vi.fn().mockResolvedValue(mockClient) } as unknown as ChromeConnection;

    const result = await handleDevtoolsStorage({
      storageType: "localStorage",
      action: "set",
      key: "foo",
      value: "bar",
    }, connection);

    expect(mockClient.Runtime.evaluate).toHaveBeenCalled();
    expect(result.content[0].text).toContain("foo");
    expect(result.content[0].text).toContain("bar");
  });

  it("deletes a key", async () => {
    const mockClient = createMockClient();
    const connection = { getClient: vi.fn().mockResolvedValue(mockClient) } as unknown as ChromeConnection;

    const result = await handleDevtoolsStorage({
      storageType: "localStorage",
      action: "delete",
      key: "foo",
    }, connection);

    expect(result.content[0].text).toContain("Deleted");
    expect(result.content[0].text).toContain("foo");
  });

  it("returns error for unknown action", async () => {
    const mockClient = createMockClient();
    const connection = { getClient: vi.fn().mockResolvedValue(mockClient) } as unknown as ChromeConnection;

    const result = await handleDevtoolsStorage({ storageType: "localStorage", action: "unknown" }, connection);

    expect(result.isError).toBe(true);
  });
});

describe("handleDevtoolsStorage - cookies", () => {
  it("lists cookies", async () => {
    const mockClient = createMockClient("{}", {
      getCookies: vi.fn().mockResolvedValue({
        cookies: [
          { name: "session", value: "abc123", domain: "example.com", path: "/" },
        ],
      }),
    });
    const connection = { getClient: vi.fn().mockResolvedValue(mockClient) } as unknown as ChromeConnection;

    const result = await handleDevtoolsStorage({ storageType: "cookies", action: "list" }, connection);

    expect(result.content[0].text).toContain("session");
    expect(result.content[0].text).toContain("abc123");
  });

  it("returns no cookies message when empty", async () => {
    const mockClient = createMockClient();
    const connection = { getClient: vi.fn().mockResolvedValue(mockClient) } as unknown as ChromeConnection;

    const result = await handleDevtoolsStorage({ storageType: "cookies", action: "list" }, connection);

    expect(result.content[0].text).toContain("No cookies");
  });

  it("gets a specific cookie by name", async () => {
    const mockClient = createMockClient("{}", {
      getCookies: vi.fn().mockResolvedValue({
        cookies: [{ name: "token", value: "xyz", domain: "example.com", path: "/" }],
      }),
    });
    const connection = { getClient: vi.fn().mockResolvedValue(mockClient) } as unknown as ChromeConnection;

    const result = await handleDevtoolsStorage({ storageType: "cookies", action: "get", key: "token" }, connection);

    expect(result.content[0].text).toContain("token");
    expect(result.content[0].text).toContain("xyz");
  });

  it("uses sessionStorage when storageType is sessionStorage", async () => {
    const mockClient = createMockClient(JSON.stringify({ sessionKey: "sessionVal" }));
    const connection = { getClient: vi.fn().mockResolvedValue(mockClient) } as unknown as ChromeConnection;

    const result = await handleDevtoolsStorage({ storageType: "sessionStorage", action: "list" }, connection);

    expect(result.content[0].text).toContain("sessionKey");
  });
});
