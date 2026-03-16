import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { ChromeConnection } from "../../core/connection.js";
import { ToolResult } from "../../types.js";

const TAB_ID_PROP = {
  tabId: {
    type: "string",
    description: "Target tab ID (from browser_tabs list). Uses active tab if omitted.",
  },
};

async function resolveElement(client: any, ref: number): Promise<{ object: { objectId: string } }> {
  return client.DOM.resolveNode({ backendNodeId: ref });
}

async function getElementCenter(client: any, ref: number): Promise<{ x: number; y: number }> {
  const { object } = await resolveElement(client, ref);
  const { result } = await client.Runtime.callFunctionOn({
    objectId: object.objectId,
    functionDeclaration: `function() {
      const r = this.getBoundingClientRect();
      return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    }`,
    returnByValue: true,
  });
  return JSON.parse(result.value as string);
}

export const scrollToolDefinition: Tool = {
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

export const selectOptionToolDefinition: Tool = {
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

export const fillFormToolDefinition: Tool = {
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

export async function handleScroll(
  args: Record<string, unknown>,
  connection: ChromeConnection
): Promise<ToolResult> {
  const client = await connection.getClient(args.tabId as string | undefined);
  const direction = args.direction as string;
  const amount = (args.amount as number) || 300;
  const deltaX = direction === "right" ? amount : direction === "left" ? -amount : 0;
  const deltaY = direction === "down" ? amount : direction === "up" ? -amount : 0;

  if (args.ref) {
    const { x, y } = await getElementCenter(client, args.ref as number);
    await client.Input.dispatchMouseEvent({ type: "mouseWheel", x, y, deltaX, deltaY });
  } else {
    await client.Input.dispatchMouseEvent({ type: "mouseWheel", x: 640, y: 360, deltaX, deltaY });
  }

  return { content: [{ type: "text", text: `Scrolled ${direction} by ${amount}px` }] };
}

export async function handleSelectOption(
  args: Record<string, unknown>,
  connection: ChromeConnection
): Promise<ToolResult> {
  const client = await connection.getClient(args.tabId as string | undefined);
  const ref = args.ref as number;
  const value = args.value as string;

  const { object } = await resolveElement(client, ref);
  await client.Runtime.callFunctionOn({
    objectId: object.objectId,
    functionDeclaration: `function(v) { this.value = v; this.dispatchEvent(new Event("change", { bubbles: true })); }`,
    arguments: [{ value }],
  });

  return { content: [{ type: "text", text: `Selected option "${value}" in element [ref=${ref}]` }] };
}

export async function handleFillForm(
  args: Record<string, unknown>,
  connection: ChromeConnection
): Promise<ToolResult> {
  const client = await connection.getClient(args.tabId as string | undefined);
  const fields = args.fields as Array<{ ref: number; value: string }>;

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
