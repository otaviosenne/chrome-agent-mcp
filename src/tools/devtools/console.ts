import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { ChromeConnection } from "../../chrome-connection.js";
import { ToolResult } from "../../types.js";

export const devtoolsConsoleToolDefinition: Tool = {
  name: "devtools_console",
  description:
    "Inspect the browser console for a tab. Start monitoring to capture future logs, then list or clear them. Equivalent to the DevTools Console panel.",
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["start", "list", "clear"],
        description: "start: begin capturing logs | list: show captured logs | clear: empty the log buffer",
      },
      tabId: {
        type: "string",
        description: "Target tab ID (from browser_tabs list). Uses active tab if omitted.",
      },
      level: {
        type: "string",
        enum: ["all", "log", "warn", "error", "info"],
        description: "Filter logs by level (default: all)",
      },
      limit: {
        type: "number",
        description: "Max entries to return (default: 50)",
      },
    },
    required: ["action"],
  },
};

export async function handleDevtoolsConsole(
  args: Record<string, unknown>,
  connection: ChromeConnection
): Promise<ToolResult> {
  const action = args.action as string;
  const tabs = await connection.listTabs();
  const tabId = (args.tabId as string | undefined) ?? connection.getActiveTabId() ?? tabs[0]?.id;

  if (!tabId) {
    return { content: [{ type: "text", text: "No tab available." }], isError: true };
  }

  if (action === "start") {
    await connection.enableConsoleMonitoring(tabId);
    return { content: [{ type: "text", text: `Console monitoring started for tab: ${tabId}` }] };
  }

  if (action === "clear") {
    connection.clearConsoleLog(tabId);
    return { content: [{ type: "text", text: `Console log cleared for tab: ${tabId}` }] };
  }

  const logs = connection.getConsoleLog(tabId);
  const level = (args.level as string | undefined) ?? "all";
  const limit = (args.limit as number | undefined) ?? 50;

  const filtered = level === "all" ? logs : logs.filter((e) => e.level === level);
  const recent = filtered.slice(-limit);

  if (recent.length === 0) {
    return {
      content: [{ type: "text", text: `No console entries${level !== "all" ? ` (level: ${level})` : ""}. Run devtools_console with action=start first.` }],
    };
  }

  const output = recent
    .map((e) => {
      const time = new Date(e.timestamp).toISOString().substring(11, 23);
      const loc = e.url ? ` (${e.url}:${e.line ?? 0})` : "";
      return `[${time}] [${e.level.toUpperCase()}] ${e.text}${loc}`;
    })
    .join("\n");

  return { content: [{ type: "text", text: `Console logs (${recent.length} entries):\n\n${output}` }] };
}
