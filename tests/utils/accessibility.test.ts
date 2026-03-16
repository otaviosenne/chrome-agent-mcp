import { describe, it, expect } from "vitest";
import { formatAccessibilityTree } from "../../src/utils/accessibility.js";
import { AXNode } from "../../src/types.js";

function makeNode(overrides: Partial<AXNode> & { nodeId: string }): AXNode {
  return {
    nodeId: overrides.nodeId,
    role: overrides.role,
    name: overrides.name,
    ignored: overrides.ignored,
    childIds: overrides.childIds,
    backendDOMNodeId: overrides.backendDOMNodeId,
    properties: overrides.properties,
    value: overrides.value,
  };
}

describe("formatAccessibilityTree", () => {
  it("returns error message for empty array", () => {
    const result = formatAccessibilityTree([]);
    expect(result).toBe("Could not capture accessibility tree");
  });

  it("returns error message when no root node found", () => {
    const nodes = [makeNode({ nodeId: "1", role: { value: "button" } })];
    const result = formatAccessibilityTree(nodes);
    expect(result).toBe("Could not capture accessibility tree");
  });

  it("formats a RootWebArea root node", () => {
    const nodes = [makeNode({ nodeId: "1", role: { value: "RootWebArea" }, name: { value: "My Page" } })];
    const result = formatAccessibilityTree(nodes);
    expect(result).toContain("RootWebArea");
    expect(result).toContain("My Page");
  });

  it("formats a WebArea root node", () => {
    const nodes = [makeNode({ nodeId: "1", role: { value: "WebArea" } })];
    const result = formatAccessibilityTree(nodes);
    expect(result).toContain("WebArea");
  });

  it("formats a document root node", () => {
    const nodes = [makeNode({ nodeId: "1", role: { value: "document" } })];
    const result = formatAccessibilityTree(nodes);
    expect(result).toContain("document");
  });

  it("ignores nodes with ignored: true", () => {
    const root = makeNode({ nodeId: "1", role: { value: "WebArea" }, childIds: ["2"] });
    const ignored = makeNode({ nodeId: "2", role: { value: "button" }, name: { value: "Click me" }, ignored: true });
    const result = formatAccessibilityTree([root, ignored]);
    expect(result).not.toContain("Click me");
  });

  it("skips SKIP_ROLES but renders children", () => {
    const root = makeNode({ nodeId: "1", role: { value: "WebArea" }, childIds: ["2"] });
    const wrapper = makeNode({ nodeId: "2", role: { value: "none" }, childIds: ["3"] });
    const button = makeNode({ nodeId: "3", role: { value: "button" }, name: { value: "Submit" } });
    const result = formatAccessibilityTree([root, wrapper, button]);
    expect(result).toContain("Submit");
    expect(result).not.toContain("- none");
  });

  it("indents child nodes deeper than parent", () => {
    const root = makeNode({ nodeId: "1", role: { value: "WebArea" }, childIds: ["2"] });
    const child = makeNode({ nodeId: "2", role: { value: "button" }, name: { value: "OK" } });
    const result = formatAccessibilityTree([root, child]);
    const lines = result.split("\n");
    const buttonLine = lines.find((l) => l.includes("button"));
    expect(buttonLine).toMatch(/^\s+/);
  });

  it("includes placeholder property in output", () => {
    const root = makeNode({
      nodeId: "1",
      role: { value: "WebArea" },
      childIds: ["2"],
    });
    const input = makeNode({
      nodeId: "2",
      role: { value: "textbox" },
      properties: [{ name: "placeholder", value: { value: "Enter email" } }],
    });
    const result = formatAccessibilityTree([root, input]);
    expect(result).toContain('placeholder: "Enter email"');
  });

  it("includes value in output", () => {
    const root = makeNode({
      nodeId: "1",
      role: { value: "WebArea" },
      childIds: ["2"],
    });
    const input = makeNode({
      nodeId: "2",
      role: { value: "textbox" },
      value: { value: "hello@example.com" },
    });
    const result = formatAccessibilityTree([root, input]);
    expect(result).toContain('value: "hello@example.com"');
  });

  it("includes checked property in output", () => {
    const root = makeNode({
      nodeId: "1",
      role: { value: "WebArea" },
      childIds: ["2"],
    });
    const checkbox = makeNode({
      nodeId: "2",
      role: { value: "checkbox" },
      properties: [{ name: "checked", value: { value: true } }],
    });
    const result = formatAccessibilityTree([root, checkbox]);
    expect(result).toContain("checked: true");
  });

  it("does not include ref for RootWebArea nodes", () => {
    const nodes = [makeNode({ nodeId: "1", role: { value: "RootWebArea" }, backendDOMNodeId: 42 })];
    const result = formatAccessibilityTree(nodes);
    expect(result).not.toContain("[ref=42]");
  });

  it("includes ref for non-root nodes", () => {
    const root = makeNode({ nodeId: "1", role: { value: "WebArea" }, childIds: ["2"] });
    const btn = makeNode({ nodeId: "2", role: { value: "button" }, name: { value: "Go" }, backendDOMNodeId: 99 });
    const result = formatAccessibilityTree([root, btn]);
    expect(result).toContain("[ref=99]");
  });
});
