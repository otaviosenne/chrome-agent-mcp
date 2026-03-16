import { formatAccessibilityTree } from "../utils/accessibility.js";
export const screenshotToolDefinition = {
    name: "browser_take_screenshot",
    description: "Take a screenshot of a page. Use browser_snapshot to find interactable elements instead. Supports targeting a specific tab via tabId.",
    inputSchema: {
        type: "object",
        properties: {
            fullPage: {
                type: "boolean",
                description: "Capture full scrollable page (default: visible viewport only)",
            },
            tabId: {
                type: "string",
                description: "Target tab ID (from browser_tabs list). Uses active tab if omitted.",
            },
        },
    },
};
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
export const evaluateToolDefinition = {
    name: "browser_evaluate",
    description: "Evaluate a JavaScript expression in a page context. Supports targeting a specific tab via tabId.",
    inputSchema: {
        type: "object",
        properties: {
            expression: {
                type: "string",
                description: "JavaScript expression or async function body to evaluate",
            },
            tabId: {
                type: "string",
                description: "Target tab ID (from browser_tabs list). Uses active tab if omitted.",
            },
        },
        required: ["expression"],
    },
};
export async function handleScreenshot(args, connection) {
    const client = await connection.getClient(args.tabId);
    let clip;
    if (args.fullPage) {
        const { result } = await client.Runtime.evaluate({
            expression: `JSON.stringify({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight })`,
            returnByValue: true,
        });
        const { width, height } = JSON.parse(result.value);
        clip = { x: 0, y: 0, width, height, scale: 1 };
    }
    const params = { format: "png" };
    if (clip)
        params.clip = clip;
    const { data } = await client.Page.captureScreenshot(params);
    return { content: [{ type: "image", data: data, mimeType: "image/png" }] };
}
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
export async function handleEvaluate(args, connection) {
    const client = await connection.getClient(args.tabId);
    const expression = args.expression;
    const { result, exceptionDetails } = await client.Runtime.evaluate({
        expression,
        returnByValue: true,
        awaitPromise: true,
    });
    if (exceptionDetails) {
        return {
            content: [{ type: "text", text: `JS Error: ${exceptionDetails.exception?.description || "Unknown error"}` }],
            isError: true,
        };
    }
    const value = result.type === "object"
        ? JSON.stringify(result.value, null, 2)
        : String(result.value);
    return { content: [{ type: "text", text: value }] };
}
