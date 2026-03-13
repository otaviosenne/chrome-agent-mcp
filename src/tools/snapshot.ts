import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { ChromeConnection } from "../chrome-connection.js";
import { formatAccessibilityTree } from "../accessibility-formatter.js";
import { AXNode, ToolResult } from "../types.js";

export const snapshotToolDefinition: Tool = {
  name: "browser_snapshot",
  description:
    "Capture accessibility snapshot of a page. Returns the page structure with element refs for interaction. Use instead of screenshots to find elements to click/type. Supports targeting a specific tab via tabId.",
  inputSchema: {
    type: "object",
    properties: {
      tabId: {
        type: "string",
        description: "Target tab ID (from browser_tabs list). Uses active tab if omitted.",
      },
    },
  },
};

export async function handleSnapshot(
  args: Record<string, unknown>,
  connection: ChromeConnection
): Promise<ToolResult> {
  const client = await connection.getClient(args.tabId as string | undefined);

  const { result: pageInfo } = await client.Runtime.evaluate({
    expression: `document.location.href + " — " + document.title`,
    returnByValue: true,
  });

  const { nodes } = await client.Accessibility.getFullAXTree({});
  const tree = formatAccessibilityTree(nodes as AXNode[]);

  return { content: [{ type: "text", text: `Page: ${pageInfo.value}\n\n${tree}` }] };
}
