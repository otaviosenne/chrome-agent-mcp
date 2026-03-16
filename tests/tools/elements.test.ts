import { describe, it, expect, vi } from "vitest";
import type { ChromeConnection } from "../../src/core/connection.js";
import { handleDevtoolsElements } from "../../src/tools/devtools/elements.js";

const ELEMENT_JSON = JSON.stringify({
  tag: "div",
  id: "main",
  classes: ["container", "active"],
  attributes: { "data-id": "42" },
  textContent: "Hello world",
  outerHTML: "<div id=\"main\">Hello world</div>",
  rect: { x: 10, y: 20, width: 300, height: 150 },
  childCount: 3,
});

function createMockConnection(evaluateValue: any = ELEMENT_JSON): ChromeConnection {
  const mockClient = {
    Runtime: {
      evaluate: vi.fn().mockResolvedValue({ result: { value: evaluateValue } }),
    },
  };
  return {
    getClient: vi.fn().mockResolvedValue(mockClient),
  } as unknown as ChromeConnection;
}

describe("handleDevtoolsElements", () => {
  it("returns element info for found selector", async () => {
    const connection = createMockConnection();

    const result = await handleDevtoolsElements({ selector: "#main" }, connection);

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("div");
    expect(result.content[0].text).toContain("main");
  });

  it("returns error when element not found (null result)", async () => {
    const connection = createMockConnection(null);

    const result = await handleDevtoolsElements({ selector: ".missing" }, connection);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("No element found");
    expect(result.content[0].text).toContain(".missing");
  });

  it("includes id in output when element has id", async () => {
    const connection = createMockConnection();

    const result = await handleDevtoolsElements({ selector: "#main" }, connection);

    expect(result.content[0].text).toContain("ID: main");
  });

  it("includes classes in output", async () => {
    const connection = createMockConnection();

    const result = await handleDevtoolsElements({ selector: "#main" }, connection);

    expect(result.content[0].text).toContain("container");
    expect(result.content[0].text).toContain("active");
  });

  it("includes size and position", async () => {
    const connection = createMockConnection();

    const result = await handleDevtoolsElements({ selector: "#main" }, connection);

    expect(result.content[0].text).toContain("300x150");
  });

  it("includes text content", async () => {
    const connection = createMockConnection();

    const result = await handleDevtoolsElements({ selector: "#main" }, connection);

    expect(result.content[0].text).toContain("Hello world");
  });

  it("includes custom attributes (excludes class and id)", async () => {
    const connection = createMockConnection();

    const result = await handleDevtoolsElements({ selector: "#main" }, connection);

    expect(result.content[0].text).toContain("data-id");
    expect(result.content[0].text).toContain("42");
  });

  it("includes computed styles when includeStyles is true", async () => {
    const stylesJson = JSON.stringify({ display: "flex", color: "red" });
    const mockClient = {
      Runtime: {
        evaluate: vi.fn()
          .mockResolvedValueOnce({ result: { value: ELEMENT_JSON } })
          .mockResolvedValueOnce({ result: { value: stylesJson } }),
      },
    };
    const connection = { getClient: vi.fn().mockResolvedValue(mockClient) } as unknown as ChromeConnection;

    const result = await handleDevtoolsElements({ selector: "#main", includeStyles: true }, connection);

    expect(result.content[0].text).toContain("Computed Styles");
    expect(result.content[0].text).toContain("display");
  });

  it("passes tabId to getClient", async () => {
    const connection = createMockConnection();

    await handleDevtoolsElements({ selector: "#main", tabId: "tab2" }, connection);

    expect(connection.getClient).toHaveBeenCalledWith("tab2");
  });
});
