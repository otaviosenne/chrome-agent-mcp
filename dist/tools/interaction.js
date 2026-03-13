const WAIT_TIMEOUT_MS = 10000;
const WAIT_POLL_INTERVAL_MS = 300;
const TAB_ID_PROP = {
    tabId: {
        type: "string",
        description: "Target tab ID (from browser_tabs list). Uses active tab if omitted.",
    },
};
async function resolveElement(client, ref) {
    return client.DOM.resolveNode({ backendNodeId: ref });
}
async function getElementCenter(client, ref) {
    const { object } = await resolveElement(client, ref);
    const { result } = await client.Runtime.callFunctionOn({
        objectId: object.objectId,
        functionDeclaration: `function() {
      const r = this.getBoundingClientRect();
      return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    }`,
        returnByValue: true,
    });
    return JSON.parse(result.value);
}
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
export const scrollToolDefinition = {
    name: "browser_scroll",
    description: "Scroll the page or a specific element. Supports targeting a specific tab via tabId.",
    inputSchema: {
        type: "object",
        properties: {
            direction: { type: "string", enum: ["up", "down", "left", "right"] },
            amount: { type: "number", description: "Pixels to scroll (default: 300)" },
            ref: { type: "number", description: "Element ref to scroll within (defaults to window)" },
            ...TAB_ID_PROP,
        },
        required: ["direction"],
    },
};
export const selectOptionToolDefinition = {
    name: "browser_select_option",
    description: "Select an option in a <select> element. Supports targeting a specific tab via tabId.",
    inputSchema: {
        type: "object",
        properties: {
            ref: { type: "number", description: "Element ref of the select element" },
            element: { type: "string", description: "Human-readable description" },
            value: { type: "string", description: "Option value to select" },
            ...TAB_ID_PROP,
        },
        required: ["ref", "value"],
    },
};
export const fillFormToolDefinition = {
    name: "browser_fill_form",
    description: "Fill multiple form fields at once. Supports targeting a specific tab via tabId.",
    inputSchema: {
        type: "object",
        properties: {
            fields: {
                type: "array",
                description: "Array of {ref, value} objects",
                items: {
                    type: "object",
                    properties: {
                        ref: { type: "number" },
                        value: { type: "string" },
                    },
                    required: ["ref", "value"],
                },
            },
            ...TAB_ID_PROP,
        },
        required: ["fields"],
    },
};
export const waitForToolDefinition = {
    name: "browser_wait_for",
    description: "Wait for text to appear on the page or wait a fixed duration. Supports targeting a specific tab via tabId.",
    inputSchema: {
        type: "object",
        properties: {
            text: { type: "string", description: "Text to wait for on the page" },
            time: { type: "number", description: "Seconds to wait (when no text provided)" },
            ...TAB_ID_PROP,
        },
    },
};
export async function handleClick(args, connection) {
    const tabId = args.tabId;
    const client = await connection.getClient(tabId);
    const resolvedTabId = tabId ?? connection.getActiveTabId() ?? "";
    const ref = args.ref;
    const { x, y } = await getElementCenter(client, ref);
    await connection.smoothMouseMove(client, resolvedTabId, x, y);
    await mouseClick(client, x, y);
    if (args.doubleClick)
        await mouseClick(client, x, y);
    return { content: [{ type: "text", text: `Clicked element [ref=${ref}] at (${Math.round(x)}, ${Math.round(y)})` }] };
}
export async function handleType(args, connection) {
    const client = await connection.getClient(args.tabId);
    const ref = args.ref;
    const text = args.text;
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
export async function handleScroll(args, connection) {
    const client = await connection.getClient(args.tabId);
    const direction = args.direction;
    const amount = args.amount || 300;
    const deltaX = direction === "right" ? amount : direction === "left" ? -amount : 0;
    const deltaY = direction === "down" ? amount : direction === "up" ? -amount : 0;
    if (args.ref) {
        const { x, y } = await getElementCenter(client, args.ref);
        await client.Input.dispatchMouseEvent({ type: "mouseWheel", x, y, deltaX, deltaY });
    }
    else {
        await client.Input.dispatchMouseEvent({ type: "mouseWheel", x: 640, y: 360, deltaX, deltaY });
    }
    return { content: [{ type: "text", text: `Scrolled ${direction} by ${amount}px` }] };
}
export async function handleSelectOption(args, connection) {
    const client = await connection.getClient(args.tabId);
    const ref = args.ref;
    const value = args.value;
    const { object } = await resolveElement(client, ref);
    await client.Runtime.callFunctionOn({
        objectId: object.objectId,
        functionDeclaration: `function(v) { this.value = v; this.dispatchEvent(new Event("change", { bubbles: true })); }`,
        arguments: [{ value }],
    });
    return { content: [{ type: "text", text: `Selected option "${value}" in element [ref=${ref}]` }] };
}
export async function handleFillForm(args, connection) {
    const client = await connection.getClient(args.tabId);
    const fields = args.fields;
    for (const field of fields) {
        const { object } = await resolveElement(client, field.ref);
        await client.Runtime.callFunctionOn({
            objectId: object.objectId,
            functionDeclaration: `function(v) {
        this.focus();
        this.value = v;
        this.dispatchEvent(new Event("input", { bubbles: true }));
        this.dispatchEvent(new Event("change", { bubbles: true }));
      }`,
            arguments: [{ value: field.value }],
        });
    }
    return { content: [{ type: "text", text: `Filled ${fields.length} form field(s)` }] };
}
export async function handleWaitFor(args, connection) {
    const client = await connection.getClient(args.tabId);
    const text = args.text;
    const timeSeconds = args.time || 0;
    if (!text) {
        await new Promise((resolve) => setTimeout(resolve, timeSeconds * 1000));
        return { content: [{ type: "text", text: `Waited ${timeSeconds}s` }] };
    }
    const deadline = Date.now() + WAIT_TIMEOUT_MS;
    while (Date.now() < deadline) {
        const { result } = await client.Runtime.evaluate({
            expression: `document.body.innerText.includes(${JSON.stringify(text)})`,
            returnByValue: true,
        });
        if (result.value)
            return { content: [{ type: "text", text: `Text found: "${text}"` }] };
        await new Promise((resolve) => setTimeout(resolve, WAIT_POLL_INTERVAL_MS));
    }
    return { content: [{ type: "text", text: `Timeout waiting for text: "${text}"` }], isError: true };
}
