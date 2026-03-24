import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { ChromeConnection } from "../../core/connection.js";
import { ToolResult } from "../../types.js";

export const devtoolsNetworkToolDefinition: Tool = {
  name: "devtools_network",
  description:
    "Inspect network requests for a tab. Start monitoring to capture future requests, then list or clear them. Equivalent to the DevTools Network panel.",
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["start", "list", "clear"],
        description: "start: begin capturing requests | list: show captured requests | clear: empty the buffer",
      },
      tabId: {
        type: "string",
        description: "Target tab ID (from browser_tabs list). Uses active tab if omitted.",
      },
      agentId: {
        type: "string",
        description: "Agent identifier for parallel execution. Pass a unique ID (e.g. 'C1', 'J2') — the server automatically routes calls to this agent's dedicated tab (registered via browser_tabs action=new).",
      },
      filter: {
        type: "string",
        enum: ["all", "XHR", "Fetch", "Document", "Script", "Stylesheet", "Image", "Font", "Other"],
        description: "Filter requests by resource type (default: all)",
      },
      urlContains: {
        type: "string",
        description: "Only show requests whose URL contains this string",
      },
      limit: {
        type: "number",
        description: "Max entries to return (default: 50)",
      },
    },
    required: ["action"],
  },
};

export async function handleDevtoolsNetwork(
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
    await connection.enableNetworkMonitoring(tabId);
    return { content: [{ type: "text", text: `Network monitoring started for tab: ${tabId}` }] };
  }

  if (action === "clear") {
    connection.clearNetworkLog(tabId);
    return { content: [{ type: "text", text: `Network log cleared for tab: ${tabId}` }] };
  }

  const requests = connection.getNetworkLog(tabId);
  const filter = (args.filter as string | undefined) ?? "all";
  const urlContains = args.urlContains as string | undefined;
  const limit = (args.limit as number | undefined) ?? 50;

  let filtered = filter === "all" ? requests : requests.filter((r) => r.resourceType === filter);
  if (urlContains) filtered = filtered.filter((r) => r.url.includes(urlContains));
  const recent = filtered.slice(-limit);

  if (recent.length === 0) {
    return {
      content: [{
        type: "text",
        text: `No network requests captured. Run devtools_network with action=start first, then reload the page.`,
      }],
    };
  }

  const output = recent
    .map((r) => {
      const status = r.status ? `${r.status} ${r.statusText}` : "pending";
      const duration = r.duration ? `${Math.round(r.duration * 1000)}ms` : "?";
      return `${r.method} ${status} [${r.resourceType}] ${duration}\n  ${r.url}`;
    })
    .join("\n\n");

  return { content: [{ type: "text", text: `Network requests (${recent.length}):\n\n${output}` }] };
}
