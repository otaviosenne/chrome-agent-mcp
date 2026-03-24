import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { ChromeConnection } from "../../core/connection.js";
import { ToolResult } from "../../types.js";

const WAIT_TIMEOUT_MS = 10000;
const WAIT_POLL_INTERVAL_MS = 300;
const MAX_WAIT_SECONDS = 10;

export const waitForToolDefinition: Tool = {
  name: "browser_wait_for",
  description: "Wait for text to appear on the page or wait a fixed duration. Max 10s per call — call multiple times for longer waits. If a previous attempt failed, do NOT increase wait time blindly; try a different action instead. Supports targeting a specific tab via tabId.",
  inputSchema: {
    type: "object",
    properties: {
      text: { type: "string", description: "Text to wait for on the page" },
      time: { type: "number", description: "Seconds to wait (when no text provided, max 10)" },
      tabId: {
        type: "string",
        description: "Target tab ID (from browser_tabs list). Uses active tab if omitted.",
      },
      agentId: {
        type: "string",
        description: "Agent identifier for parallel execution. Pass a unique ID (e.g. 'C1', 'J2') — the server automatically routes calls to this agent's dedicated tab (registered via browser_tabs action=new).",
      },
    },
  },
};

async function pageContainsText(client: any, text: string): Promise<boolean> {
  const { result } = await client.Runtime.evaluate({
    expression: `document.body.innerText.includes(${JSON.stringify(text)})`,
    returnByValue: true,
  });
  return result.value as boolean;
}

export async function handleWaitFor(
  args: Record<string, unknown>,
  connection: ChromeConnection
): Promise<ToolResult> {
  const client = await connection.getClient(args.tabId as string | undefined);
  const text = args.text as string | undefined;
  const timeSeconds = (args.time as number) || 0;

  if (!text) {
    const capped = Math.min(timeSeconds, MAX_WAIT_SECONDS);
    await new Promise((resolve) => setTimeout(resolve, capped * 1000));
    return { content: [{ type: "text", text: `Waited ${capped}s` }] };
  }

  if (await pageContainsText(client, text)) {
    return { content: [{ type: "text", text: `Text found: "${text}"` }] };
  }

  const deadline = Date.now() + WAIT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, WAIT_POLL_INTERVAL_MS));
    if (await pageContainsText(client, text)) {
      return { content: [{ type: "text", text: `Text found: "${text}"` }] };
    }
  }

  if (await pageContainsText(client, text)) {
    return { content: [{ type: "text", text: `Text found: "${text}"` }] };
  }

  return { content: [{ type: "text", text: `Timeout waiting for text: "${text}"` }], isError: true };
}
