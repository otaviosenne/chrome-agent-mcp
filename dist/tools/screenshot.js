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
