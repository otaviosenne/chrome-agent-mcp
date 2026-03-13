import { formatAccessibilityTree } from "../accessibility-formatter.js";
export const snapshotToolDefinition = {
    name: "browser_snapshot",
    description: "Capture accessibility snapshot of a page. Returns the page structure with element refs for interaction. Use instead of screenshots to find elements to click/type. Supports targeting a specific tab via tabId.",
    inputSchema: {
        type: "object",
        properties: {
            tabId: {
                type: "string",
                description: "Target tab ID (from browser_tabs list). Uses active tab if omitted.",
            },
        },
    },
};
export async function handleSnapshot(args, connection) {
    const client = await connection.getClient(args.tabId);
    const { result: pageInfo } = await client.Runtime.evaluate({
        expression: `document.location.href + " — " + document.title`,
        returnByValue: true,
    });
    const { nodes } = await client.Accessibility.getFullAXTree({});
    const tree = formatAccessibilityTree(nodes);
    return { content: [{ type: "text", text: `Page: ${pageInfo.value}\n\n${tree}` }] };
}
