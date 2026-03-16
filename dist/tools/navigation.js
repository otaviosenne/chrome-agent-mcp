const LOAD_TIMEOUT_MS = 15000;
const TAB_ID_PROP = {
    tabId: {
        type: "string",
        description: "Target tab ID (from browser_tabs list). Uses active tab if omitted.",
    },
};
async function waitForLoad(client) {
    return new Promise((resolve) => {
        const timer = setTimeout(resolve, LOAD_TIMEOUT_MS);
        client.Page.loadEventFired(() => {
            clearTimeout(timer);
            resolve();
        });
    });
}
async function getCurrentUrl(client) {
    const { result } = await client.Runtime.evaluate({
        expression: "document.location.href",
        returnByValue: true,
    });
    return result.value;
}
export const navigateToolDefinition = {
    name: "browser_navigate",
    description: "Navigate to a URL in the specified tab (or active tab)",
    inputSchema: {
        type: "object",
        properties: {
            url: { type: "string", description: "URL to navigate to" },
            ...TAB_ID_PROP,
        },
        required: ["url"],
    },
};
export const navigateBackToolDefinition = {
    name: "browser_navigate_back",
    description: "Go back in history for the specified tab",
    inputSchema: { type: "object", properties: { ...TAB_ID_PROP } },
};
export const navigateForwardToolDefinition = {
    name: "browser_navigate_forward",
    description: "Go forward in history for the specified tab",
    inputSchema: { type: "object", properties: { ...TAB_ID_PROP } },
};
export const reloadToolDefinition = {
    name: "browser_reload",
    description: "Reload the page in the specified tab",
    inputSchema: { type: "object", properties: { ...TAB_ID_PROP } },
};
export async function handleNavigate(args, connection) {
    const url = args.url;
    const explicitTabId = args.tabId;
    if (!explicitTabId && !connection.tabGroup.hasOwnedTabs()) {
        const tab = await connection.newTab(url);
        return { content: [{ type: "text", text: `Navigated to: ${url}\ntabId=${tab.id}` }] };
    }
    const client = await connection.getClient(explicitTabId);
    const loadPromise = waitForLoad(client);
    await client.Page.navigate({ url });
    await loadPromise;
    const { result } = await client.Runtime.evaluate({ expression: "document.title", returnByValue: true });
    return { content: [{ type: "text", text: `Navigated to: ${url}\nTitle: ${result.value}` }] };
}
export async function handleNavigateBack(args, connection) {
    const client = await connection.getClient(args.tabId);
    const loadPromise = waitForLoad(client);
    await client.Page.goBack({});
    await loadPromise;
    const url = await getCurrentUrl(client);
    return { content: [{ type: "text", text: `Navigated back to: ${url}` }] };
}
export async function handleNavigateForward(args, connection) {
    const client = await connection.getClient(args.tabId);
    const loadPromise = waitForLoad(client);
    await client.Page.goForward({});
    await loadPromise;
    const url = await getCurrentUrl(client);
    return { content: [{ type: "text", text: `Navigated forward to: ${url}` }] };
}
export async function handleReload(args, connection) {
    const client = await connection.getClient(args.tabId);
    const loadPromise = waitForLoad(client);
    await client.Page.reload({});
    await loadPromise;
    return { content: [{ type: "text", text: "Page reloaded" }] };
}
