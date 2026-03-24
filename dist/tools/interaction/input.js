import { resolveElement, getElementCenter, checkElementVisible } from "./dom-utils.js";
const TAB_ID_PROP = {
    tabId: {
        type: "string",
        description: "Target tab ID (from browser_tabs list). Uses active tab if omitted.",
    },
    agentId: {
        type: "string",
        description: "Agent identifier for parallel execution. Pass a unique ID (e.g. 'C1', 'J2') — the server automatically routes calls to this agent's dedicated tab (registered via browser_tabs action=new).",
    },
};
async function mouseClick(client, x, y) {
    await client.Input.dispatchMouseEvent({ type: "mousePressed", x, y, button: "left", clickCount: 1 });
    try {
        await new Promise((r) => setTimeout(r, 40 + Math.random() * 60));
    }
    finally {
        await client.Input.dispatchMouseEvent({ type: "mouseReleased", x, y, button: "left", clickCount: 1 });
    }
}
export const clickToolDefinition = {
    name: "browser_click",
    description: "Click on an element using its ref from browser_snapshot. Supports targeting a specific tab via tabId.",
    inputSchema: {
        type: "object",
        properties: {
            ref: { type: "number", description: "Element ref from page snapshot" },
            element: { type: "string", description: "Human-readable description of the element" },
            doubleClick: { type: "boolean", description: "Whether to perform a double click" },
            ...TAB_ID_PROP,
        },
        required: ["ref"],
    },
};
export const typeToolDefinition = {
    name: "browser_type",
    description: "Type text into an input element. Supports targeting a specific tab via tabId.",
    inputSchema: {
        type: "object",
        properties: {
            ref: { type: "number", description: "Element ref from page snapshot" },
            element: { type: "string", description: "Human-readable description of the element" },
            text: { type: "string", description: "Text to type" },
            submit: { type: "boolean", description: "Press Enter after typing" },
            ...TAB_ID_PROP,
        },
        required: ["ref", "text"],
    },
};
export const hoverToolDefinition = {
    name: "browser_hover",
    description: "Hover the mouse over an element. Supports targeting a specific tab via tabId.",
    inputSchema: {
        type: "object",
        properties: {
            ref: { type: "number", description: "Element ref from page snapshot" },
            element: { type: "string", description: "Human-readable description of the element" },
            ...TAB_ID_PROP,
        },
        required: ["ref"],
    },
};
export const pressKeyToolDefinition = {
    name: "browser_press_key",
    description: "Press a keyboard key in the specified tab.",
    inputSchema: {
        type: "object",
        properties: {
            key: { type: "string", description: "Key name (e.g. Enter, Escape, Tab, ArrowDown, Backspace)" },
            ...TAB_ID_PROP,
        },
        required: ["key"],
    },
};
export async function handleClick(args, connection) {
    const tabId = args.tabId;
    const client = await connection.getClient(tabId);
    const resolvedTabId = tabId ?? connection.getActiveTabId() ?? "";
    const ref = args.ref;
    await checkElementVisible(client, ref);
    const { x, y } = await getElementCenter(client, ref);
    await connection.smoothMouseMove(client, resolvedTabId, x, y);
    await mouseClick(client, x, y);
    connection.showCursorClickRipple(client, x, y).catch(() => { });
    if (args.doubleClick) {
        await mouseClick(client, x, y);
        connection.showCursorClickRipple(client, x, y).catch(() => { });
    }
    return { content: [{ type: "text", text: `Clicked element [ref=${ref}] at (${Math.round(x)}, ${Math.round(y)})` }] };
}
export async function handleType(args, connection) {
    const client = await connection.getClient(args.tabId);
    const ref = args.ref;
    const text = args.text;
    if (typeof text !== "string") {
        return { content: [{ type: "text", text: "Error: text argument is required" }], isError: true };
    }
    const { object } = await resolveElement(client, ref);
    await client.Runtime.callFunctionOn({
        objectId: object.objectId,
        functionDeclaration: `function() { this.focus(); if (this.select) this.select(); }`,
    });
    await client.Input.insertText({ text });
    if (args.submit) {
        await client.Input.dispatchKeyEvent({ type: "keyDown", key: "Enter" });
        await client.Input.dispatchKeyEvent({ type: "keyUp", key: "Enter" });
    }
    return { content: [{ type: "text", text: `Typed "${text}" into element [ref=${ref}]` }] };
}
export async function handleHover(args, connection) {
    const tabId = args.tabId;
    const client = await connection.getClient(tabId);
    const resolvedTabId = tabId ?? connection.getActiveTabId() ?? "";
    const ref = args.ref;
    await checkElementVisible(client, ref);
    const { x, y } = await getElementCenter(client, ref);
    await connection.smoothMouseMove(client, resolvedTabId, x, y);
    return { content: [{ type: "text", text: `Hovered over element [ref=${ref}]` }] };
}
export async function handlePressKey(args, connection) {
    const client = await connection.getClient(args.tabId);
    const key = args.key;
    await client.Input.dispatchKeyEvent({ type: "keyDown", key });
    await client.Input.dispatchKeyEvent({ type: "keyUp", key });
    return { content: [{ type: "text", text: `Pressed key: ${key}` }] };
}
