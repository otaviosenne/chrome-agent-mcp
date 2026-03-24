import { resolveElement, buildFieldResults } from "./dom-utils.js";
const SCROLL_MS_PER_PX = 0.35;
const SCROLL_MIN_MS = 80;
const SCROLL_MAX_MS = 500;
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
async function animateScroll(client, deltaX, deltaY, elementRef) {
    const total = Math.abs(deltaX) || Math.abs(deltaY);
    const duration = Math.max(SCROLL_MIN_MS, Math.min(SCROLL_MAX_MS, total * SCROLL_MS_PER_PX));
    const expression = elementRef
        ? buildElementScrollExpression(elementRef, deltaX, deltaY, duration)
        : buildWindowScrollExpression(deltaX, deltaY, duration);
    await client.Runtime.evaluate({ expression, awaitPromise: true });
}
function buildWindowScrollExpression(deltaX, deltaY, duration) {
    return `
    new Promise(resolve => {
      const startX = window.scrollX;
      const startY = window.scrollY;
      const startTime = performance.now();
      function step(now) {
        const t = Math.min((now - startTime) / ${duration}, 1);
        const e = t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t;
        window.scrollTo(startX + ${deltaX} * e, startY + ${deltaY} * e);
        if (t < 1) requestAnimationFrame(step); else resolve();
      }
      requestAnimationFrame(step);
    })
  `;
}
function buildElementScrollExpression(ref, deltaX, deltaY, duration) {
    return `
    new Promise(resolve => {
      const el = window.__claudeRefs && window.__claudeRefs[${ref}];
      if (!el) { resolve(); return; }
      const startX = el.scrollLeft;
      const startY = el.scrollTop;
      const startTime = performance.now();
      function step(now) {
        const t = Math.min((now - startTime) / ${duration}, 1);
        const e = t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t;
        el.scrollLeft = startX + ${deltaX} * e;
        el.scrollTop = startY + ${deltaY} * e;
        if (t < 1) requestAnimationFrame(step); else resolve();
      }
      requestAnimationFrame(step);
    })
  `;
}
export async function handleScroll(args, connection) {
    const client = await connection.getClient(args.tabId);
    const direction = args.direction;
    const amount = Number(args.amount) || 300;
    const deltaX = direction === "right" ? amount : direction === "left" ? -amount : 0;
    const deltaY = direction === "down" ? amount : direction === "up" ? -amount : 0;
    await animateScroll(client, deltaX, deltaY, args.ref);
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
async function resolveAllElements(client, fields) {
    const resolved = [];
    for (const field of fields) {
        const { object } = await resolveElement(client, field.ref);
        resolved.push({ objectId: object.objectId, ref: field.ref, value: field.value });
    }
    return resolved;
}
async function fillResolvedField(client, objectId, value) {
    await client.Runtime.callFunctionOn({
        objectId,
        functionDeclaration: `function(v) {
      this.focus();
      this.value = v;
      this.dispatchEvent(new Event("input", { bubbles: true }));
      this.dispatchEvent(new Event("change", { bubbles: true }));
    }`,
        arguments: [{ value }],
    });
}
export async function handleFillForm(args, connection) {
    const client = await connection.getClient(args.tabId);
    const fields = args.fields;
    let resolved;
    try {
        resolved = await resolveAllElements(client, fields);
    }
    catch (e) {
        return { content: [{ type: "text", text: `Failed to resolve form fields: ${String(e)}` }], isError: true };
    }
    const results = [];
    for (const field of resolved) {
        try {
            await fillResolvedField(client, field.objectId, field.value);
            results.push({ ref: field.ref, success: true });
        }
        catch (e) {
            results.push({ ref: field.ref, success: false, error: String(e) });
        }
    }
    return buildFieldResults(results);
}
