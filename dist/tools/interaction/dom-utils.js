export async function resolveElement(client, ref) {
    return client.DOM.resolveNode({ backendNodeId: ref });
}
export async function checkElementVisible(client, nodeId) {
    let model;
    try {
        model = await client.DOM.getBoxModel({ backendNodeId: nodeId });
    }
    catch {
        throw new Error("Element not visible or not in viewport");
    }
    if (!model?.model?.content || model.model.content.length === 0) {
        throw new Error("Element not visible or not in viewport");
    }
}
export async function getElementCenter(client, ref) {
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
    let parsed;
    try {
        parsed = JSON.parse(result.value);
    }
    catch {
        throw new Error(`Failed to parse element center for ref=${ref}`);
    }
    if (parsed.hidden) {
        throw new Error(`Element [ref=${ref}] is not visible (zero dimensions)`);
    }
    return { x: parsed.x, y: parsed.y };
}
export function buildFieldResults(results) {
    const failed = results.filter((r) => !r.success);
    if (failed.length > 0) {
        const text = `Filled ${results.length - failed.length}/${results.length} fields. Failed: ${failed.map((f) => `ref=${f.ref}: ${f.error}`).join("; ")}`;
        return { content: [{ type: "text", text }], isError: true };
    }
    return { content: [{ type: "text", text: `Filled ${results.length} form field(s)` }] };
}
