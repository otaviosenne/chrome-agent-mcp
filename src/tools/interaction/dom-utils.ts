import { ToolResult } from "../../types.js";

export async function resolveElement(
  client: any,
  ref: number
): Promise<{ object: { objectId: string } }> {
  return client.DOM.resolveNode({ backendNodeId: ref });
}

export async function checkElementVisible(client: any, nodeId: number): Promise<void> {
  let model: { model?: { content?: number[][] } } | undefined;
  try {
    model = await client.DOM.getBoxModel({ backendNodeId: nodeId });
  } catch {
    throw new Error("Element not visible or not in viewport");
  }
  if (!model?.model?.content || model.model.content.length === 0) {
    throw new Error("Element not visible or not in viewport");
  }
}

export async function getElementCenter(
  client: any,
  ref: number
): Promise<{ x: number; y: number }> {
  const { object } = await resolveElement(client, ref);
  const { result } = await client.Runtime.callFunctionOn({
    objectId: object.objectId,
    functionDeclaration: `function() {
      const r = this.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return JSON.stringify({ hidden: true });
      return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    }`,
    returnByValue: true,
  });

  let parsed: { x?: number; y?: number; hidden?: boolean };
  try {
    parsed = JSON.parse(result.value as string);
  } catch {
    throw new Error(`Failed to parse element center for ref=${ref}`);
  }

  if (parsed.hidden) {
    throw new Error(`Element [ref=${ref}] is not visible (zero dimensions)`);
  }

  return { x: parsed.x as number, y: parsed.y as number };
}

export function buildFieldResults(
  results: { ref: number; success: boolean; error?: string }[]
): ToolResult {
  const failed = results.filter((r) => !r.success);
  if (failed.length > 0) {
    const text = `Filled ${results.length - failed.length}/${results.length} fields. Failed: ${failed.map((f) => `ref=${f.ref}: ${f.error}`).join("; ")}`;
    return { content: [{ type: "text", text }], isError: true } as any;
  }
  return { content: [{ type: "text", text: `Filled ${results.length} form field(s)` }] };
}
