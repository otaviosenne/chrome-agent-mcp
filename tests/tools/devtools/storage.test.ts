import { describe, it, expect, vi } from "vitest";
import type { ChromeConnection } from "../../../src/core/connection.js";
import { handleDevtoolsStorage } from "../../../src/tools/devtools/storage.js";

function createMockClient(hostnameValue: string = "example.com", networkOverrides: Partial<any> = {}): any {
  return {
    Runtime: {
      evaluate: vi.fn().mockResolvedValue({ result: { value: hostnameValue } }),
    },
    Network: {
      getCookies: vi.fn().mockResolvedValue({ cookies: [] }),
      setCookie: vi.fn().mockResolvedValue({}),
      deleteCookies: vi.fn().mockResolvedValue({}),
      ...networkOverrides,
    },
  };
}

function createConnection(mockClient: any): ChromeConnection {
  return { getClient: vi.fn().mockResolvedValue(mockClient) } as unknown as ChromeConnection;
}

describe("handleDevtoolsStorage - cookie set", () => {
  it("uses page hostname as domain when no domain arg provided", async () => {
    const mockClient = createMockClient("example.com");
    const connection = createConnection(mockClient);

    await handleDevtoolsStorage({ storageType: "cookies", action: "set", key: "tok", value: "abc" }, connection);

    expect(mockClient.Network.setCookie).toHaveBeenCalledWith(
      expect.objectContaining({ domain: "example.com", path: "/" })
    );
  });

  it("resolves hostname via Runtime.evaluate for cookie set", async () => {
    const mockClient = createMockClient("myapp.io");
    const connection = createConnection(mockClient);

    await handleDevtoolsStorage({ storageType: "cookies", action: "set", key: "x", value: "y" }, connection);

    expect(mockClient.Runtime.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ expression: "window.location.hostname" })
    );
    expect(mockClient.Network.setCookie).toHaveBeenCalledWith(
      expect.objectContaining({ domain: "myapp.io" })
    );
  });

  it("sets cookie name and value from args", async () => {
    const mockClient = createMockClient("example.com");
    const connection = createConnection(mockClient);

    await handleDevtoolsStorage({ storageType: "cookies", action: "set", key: "session", value: "token123" }, connection);

    expect(mockClient.Network.setCookie).toHaveBeenCalledWith(
      expect.objectContaining({ name: "session", value: "token123" })
    );
  });
});

describe("handleDevtoolsStorage - cookie delete", () => {
  it("uses page hostname as domain when no domain arg provided", async () => {
    const mockClient = createMockClient("example.com");
    const connection = createConnection(mockClient);

    await handleDevtoolsStorage({ storageType: "cookies", action: "delete", key: "tok" }, connection);

    expect(mockClient.Network.deleteCookies).toHaveBeenCalledWith(
      expect.objectContaining({ domain: "example.com", path: "/" })
    );
  });

  it("resolves hostname via Runtime.evaluate for cookie delete", async () => {
    const mockClient = createMockClient("staging.myapp.io");
    const connection = createConnection(mockClient);

    await handleDevtoolsStorage({ storageType: "cookies", action: "delete", key: "auth" }, connection);

    expect(mockClient.Runtime.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({ expression: "window.location.hostname" })
    );
    expect(mockClient.Network.deleteCookies).toHaveBeenCalledWith(
      expect.objectContaining({ domain: "staging.myapp.io" })
    );
  });

  it("deletes by the provided key name", async () => {
    const mockClient = createMockClient("example.com");
    const connection = createConnection(mockClient);

    await handleDevtoolsStorage({ storageType: "cookies", action: "delete", key: "refresh_token" }, connection);

    expect(mockClient.Network.deleteCookies).toHaveBeenCalledWith(
      expect.objectContaining({ name: "refresh_token" })
    );
  });
});

describe("handleDevtoolsStorage - cookie list and get", () => {
  it("lists cookies from Network.getCookies", async () => {
    const mockClient = createMockClient("example.com", {
      getCookies: vi.fn().mockResolvedValue({
        cookies: [{ name: "session", value: "abc123", domain: "example.com", path: "/" }],
      }),
    });
    const connection = createConnection(mockClient);

    const result = await handleDevtoolsStorage({ storageType: "cookies", action: "list" }, connection);

    expect(result.content[0].text).toContain("session");
    expect(result.content[0].text).toContain("abc123");
  });

  it("gets a specific cookie by name", async () => {
    const mockClient = createMockClient("example.com", {
      getCookies: vi.fn().mockResolvedValue({
        cookies: [{ name: "token", value: "xyz", domain: "example.com", path: "/" }],
      }),
    });
    const connection = createConnection(mockClient);

    const result = await handleDevtoolsStorage({ storageType: "cookies", action: "get", key: "token" }, connection);

    expect(result.content[0].text).toContain("token");
    expect(result.content[0].text).toContain("xyz");
  });

  it("returns no cookies message when list is empty", async () => {
    const mockClient = createMockClient();
    const connection = createConnection(mockClient);

    const result = await handleDevtoolsStorage({ storageType: "cookies", action: "list" }, connection);

    expect(result.content[0].text).toContain("No cookies");
  });
});
