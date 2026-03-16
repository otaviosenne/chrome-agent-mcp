import { Tool } from "@modelcontextprotocol/sdk/types.js";
import CDP from "chrome-remote-interface";
import { ChromeConnection } from "../core/connection.js";
import { ToolResult } from "../types.js";

const DEBUG_PORT = parseInt(process.env.CHROME_DEBUG_PORT ?? "9222", 10);

export const chromeWindowsToolDefinition: Tool = {
  name: "chrome_windows",
  description:
    "Manage Chrome browser windows. List all windows with their tabs, or focus a specific window. Each window groups multiple tabs.",
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["list"],
        description: "list: show all windows and their tabs",
      },
    },
    required: ["action"],
  },
};

export const chromeFocusToolDefinition: Tool = {
  name: "chrome_focus",
  description: "Bring a specific Chrome tab into focus (activate it in the browser UI).",
  inputSchema: {
    type: "object",
    properties: {
      tabId: {
        type: "string",
        description: "Tab ID to bring into focus (from browser_tabs list)",
      },
    },
    required: ["tabId"],
  },
};

export const chromeExtensionsToolDefinition: Tool = {
  name: "chrome_extensions",
  description: "List installed Chrome extensions.",
  inputSchema: {
    type: "object",
    properties: {},
  },
};

export async function handleChromeWindows(
  args: Record<string, unknown>,
  connection: ChromeConnection
): Promise<ToolResult> {
  const action = args.action as string;

  if (action === "list") {
    const targets = await (CDP as any).List({ port: DEBUG_PORT });
    const pages = targets.filter((t: any) => t.type === "page");

    const windowGroups = new Map<string, typeof pages>();
    for (const page of pages) {
      const windowId = page.url.startsWith("chrome-extension://") ? "extensions" : "browser";
      if (!windowGroups.has(windowId)) windowGroups.set(windowId, []);
      windowGroups.get(windowId)!.push(page);
    }

    const allTabs = await connection.listTabs();
    const output = allTabs
      .map((t, i) => `[${i}] tabId=${t.id}\n    ${t.title}\n    ${t.url}`)
      .join("\n\n");

    return {
      content: [{
        type: "text",
        text: `Chrome tabs (${allTabs.length} total):\n\n${output}\n\nNote: Use browser_tabs to manage individual tabs.`,
      }],
    };
  }

  return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
}

export async function handleChromeFocus(
  args: Record<string, unknown>,
  connection: ChromeConnection
): Promise<ToolResult> {
  const tabId = args.tabId as string;
  const client = await connection.getClientForTab(tabId);

  try {
    await client.Target.activateTarget({ targetId: tabId });
  } catch {
    await client.Runtime.evaluate({ expression: "window.focus()", returnByValue: true });
  }

  return { content: [{ type: "text", text: `Focused tab: ${tabId}` }] };
}

export async function handleChromeExtensions(
  _args: Record<string, unknown>,
  _connection: ChromeConnection
): Promise<ToolResult> {
  const targets = await (CDP as any).List({ port: DEBUG_PORT });
  const extensions = targets.filter(
    (t: any) =>
      t.type === "background_page" ||
      t.url?.startsWith("chrome-extension://") ||
      t.type === "service_worker"
  );

  if (extensions.length === 0) {
    return { content: [{ type: "text", text: "No extensions detected (or none with debug access)." }] };
  }

  const output = extensions
    .map((e: any) => `  [${e.type}] ${e.title || e.url}\n    ${e.url}`)
    .join("\n\n");

  return { content: [{ type: "text", text: `Detected extensions (${extensions.length}):\n\n${output}` }] };
}
