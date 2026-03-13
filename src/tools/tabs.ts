import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { ChromeConnection } from "../chrome-connection.js";
import { ToolResult } from "../types.js";

export const tabsToolDefinition: Tool = {
  name: "browser_tabs",
  description:
    "List, create, close, or switch browser tabs. Returns tabId for each tab — pass tabId to other tools to target a specific tab without switching.",
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["list", "new", "close", "switch", "done"],
        description: "Operation to perform. Use 'done' when finished working with a tab to show a completion indicator on its favicon.",
      },
      tabId: {
        type: "string",
        description: "Tab ID for close/switch actions (from list output)",
      },
      index: {
        type: "number",
        description: "Tab index (0-based) as alternative to tabId for close/switch",
      },
      url: { type: "string", description: "URL to open in new tab" },
    },
    required: ["action"],
  },
};

export async function handleTabs(
  args: Record<string, unknown>,
  connection: ChromeConnection
): Promise<ToolResult> {
  const action = args.action as string;
  const tabs = await connection.listTabs();

  if (action === "list") {
    const groupName = connection.tabGroup.getGroupName();
    const groupHeader = connection.tabGroup.hasOwnedTabs()
      ? `Group: ${groupName} (${tabs.length} tab${tabs.length !== 1 ? "s" : ""})\n\n`
      : `No group active yet — use action=new to create a tab in the Claude group.\n\n`;
    const list = tabs
      .map((t, i) => `[${i}] tabId=${t.id}\n    Title: ${t.title}\n    URL: ${t.url}`)
      .join("\n\n");
    return {
      content: [{ type: "text", text: `${groupHeader}${list}` }],
    };
  }

  if (action === "new") {
    const tab = await connection.newTab(args.url as string | undefined);
    const groupName = connection.tabGroup.getGroupName();
    return {
      content: [{
        type: "text",
        text: `Opened new tab in group [${groupName}]:\n  tabId=${tab.id}\n  URL: ${tab.url}`,
      }],
    };
  }

  const resolvedTabId = args.tabId as string | undefined;
  const index = args.index as number | undefined;

  let targetTabId: string;
  if (resolvedTabId) {
    targetTabId = resolvedTabId;
  } else if (index !== undefined && index >= 0 && index < tabs.length) {
    targetTabId = tabs[index].id;
  } else {
    return {
      content: [{ type: "text", text: "Provide tabId or a valid index. Run browser_tabs with action=list first." }],
      isError: true,
    };
  }

  const target = tabs.find((t) => t.id === targetTabId);
  if (!target) {
    return {
      content: [{ type: "text", text: `Tab not found: ${targetTabId}` }],
      isError: true,
    };
  }

  if (action === "close") {
    await connection.closeTab(targetTabId);
    return { content: [{ type: "text", text: `Closed tab: ${target.title}` }] };
  }

  if (action === "switch") {
    connection.setActiveTab(targetTabId);
    return {
      content: [{ type: "text", text: `Switched active tab to:\n  tabId=${targetTabId}\n  ${target.title}\n  ${target.url}` }],
    };
  }

  return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
}
