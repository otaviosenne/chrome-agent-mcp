import { AXNode } from "../types.js";

const SKIP_ROLES = new Set([
  "none",
  "presentation",
  "InlineTextBox",
  "LineBreak",
  "ignored",
]);

const ROLES_WITHOUT_REF = new Set(["document", "WebArea", "RootWebArea"]);

function getProperty(node: AXNode, propName: string): unknown {
  return node.properties?.find((p) => p.name === propName)?.value?.value;
}

function formatChildren(node: AXNode, nodeMap: Map<string, AXNode>, depth: number): string {
  if (!node.childIds?.length) return "";
  return node.childIds
    .map((id) => {
      const child = nodeMap.get(id);
      return child ? formatNode(child, nodeMap, depth) : "";
    })
    .filter(Boolean)
    .join("\n");
}

function formatNode(node: AXNode, nodeMap: Map<string, AXNode>, depth: number): string {
  if (node.ignored) return "";

  const role = node.role?.value || "generic";
  if (SKIP_ROLES.has(role)) return formatChildren(node, nodeMap, depth);

  const name = node.name?.value;
  const ref = node.backendDOMNodeId;
  const indent = "  ".repeat(depth);

  let line = `${indent}- ${role}`;
  if (name) line += ` "${name}"`;
  if (ref && !ROLES_WITHOUT_REF.has(role)) line += ` [ref=${ref}]`;

  const extras: string[] = [];

  const placeholder = getProperty(node, "placeholder");
  if (placeholder) extras.push(`placeholder: "${placeholder}"`);

  const nodeValue = node.value?.value;
  if (nodeValue !== undefined && nodeValue !== "") extras.push(`value: "${nodeValue}"`);

  const checked = getProperty(node, "checked");
  if (checked !== undefined) extras.push(`checked: ${checked}`);

  const expanded = getProperty(node, "expanded");
  if (expanded !== undefined) extras.push(`expanded: ${expanded}`);

  const childrenStr = formatChildren(node, nodeMap, depth + 1);
  const extrasStr = extras.map((e) => `${"  ".repeat(depth + 1)}${e}`).join("\n");

  return [line, extrasStr, childrenStr].filter(Boolean).join("\n");
}

export function formatAccessibilityTree(nodes: AXNode[]): string {
  const nodeMap = new Map(nodes.map((n) => [n.nodeId, n]));
  const root = nodes.find(
    (n) =>
      n.role?.value === "document" ||
      n.role?.value === "RootWebArea" ||
      n.role?.value === "WebArea"
  );
  if (!root) return "Could not capture accessibility tree";
  return formatNode(root, nodeMap, 0);
}
