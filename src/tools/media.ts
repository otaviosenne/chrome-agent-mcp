import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { ChromeConnection } from "../core/connection.js";
import { formatAccessibilityTree } from "../utils/accessibility.js";
import { AXNode, ToolResult } from "../types.js";

export const screenshotToolDefinition: Tool = {
  name: "browser_take_screenshot",
  description:
    "Take a screenshot of a page. Use browser_snapshot to find interactable elements instead. Supports targeting a specific tab via tabId.",
  inputSchema: {
    type: "object",
    properties: {
      fullPage: {
        type: "boolean",
        description: "Capture full scrollable page (default: visible viewport only)",
      },
      tabId: {
        type: "string",
        description: "Target tab ID (from browser_tabs list). Uses active tab if omitted.",
      },
    },
  },
};

export const snapshotToolDefinition: Tool = {
  name: "browser_snapshot",
  description:
    "Capture accessibility snapshot of a page. Returns the page structure with element refs for interaction. " +
    "Use instead of screenshots to find elements to click/type. " +
    "IMPORTANT: refs go stale after any DOM change or navigation — always re-snapshot before clicking if the page may have changed. " +
    "Supports targeting a specific tab via tabId.",
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

export const evaluateToolDefinition: Tool = {
  name: "browser_evaluate",
  description:
    "Evaluate JavaScript in a page context. " +
    "IMPORTANT: top-level const/let/var declarations persist across calls — always wrap multi-statement code in an IIFE: (() => { const x = ...; return x; })(). " +
    "Never use bare 'return' at top level. Max timeout: 10s — avoid setTimeout > 10000ms. " +
    "Supports targeting a specific tab via tabId.",
  inputSchema: {
    type: "object",
    properties: {
      expression: {
        type: "string",
        description: "JavaScript expression or IIFE to evaluate",
      },
      tabId: {
        type: "string",
        description: "Target tab ID (from browser_tabs list). Uses active tab if omitted.",
      },
    },
    required: ["expression"],
  },
};

const SCREENSHOT_READY_TIMEOUT_MS = 3000;

export async function handleScreenshot(
  args: Record<string, unknown>,
  connection: ChromeConnection
): Promise<ToolResult> {
  const client = await connection.getClient(args.tabId as string | undefined);

  const { result: readyStateResult } = await client.Runtime.evaluate({
    expression: `document.readyState`,
    returnByValue: true,
  });

  if (readyStateResult.value === "loading") {
    await Promise.race([
      client.Page.loadEventFired(),
      new Promise((resolve) => setTimeout(resolve, SCREENSHOT_READY_TIMEOUT_MS)),
    ]);
  }

  let clip;
  if (args.fullPage) {
    const { result } = await client.Runtime.evaluate({
      expression: `JSON.stringify({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight })`,
      returnByValue: true,
    });
    const { width, height } = JSON.parse(result.value as string);
    clip = { x: 0, y: 0, width, height, scale: 1 };
  }

  const params: Record<string, unknown> = { format: "png" };
  if (clip) params.clip = clip;

  const { data } = await client.Page.captureScreenshot(params);
  return { content: [{ type: "image", data: data as string, mimeType: "image/png" }] };
}

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

const NEEDS_IIFE_RE = /(?:^|\n)\s*(?:const |let |var |return )/;

export function wrapForEvaluation(expression: string): string {
  const trimmed = expression.trim();
  if (trimmed.startsWith("(")) return expression;
  if (!NEEDS_IIFE_RE.test(trimmed)) return expression;
  return `(async () => {\n${trimmed}\n})()`;
}

export async function handleEvaluate(
  args: Record<string, unknown>,
  connection: ChromeConnection
): Promise<ToolResult> {
  if (!args.expression || typeof args.expression !== "string") {
    return { content: [{ type: "text", text: "Error: expression is required" }], isError: true };
  }

  const client = await connection.getClient(args.tabId as string | undefined);
  const expression = wrapForEvaluation(args.expression);

  const { result, exceptionDetails } = await client.Runtime.evaluate({
    expression,
    returnByValue: true,
    awaitPromise: true,
  });

  if (exceptionDetails) {
    return {
      content: [{ type: "text", text: `JS Error: ${exceptionDetails.exception?.description || "Unknown error"}` }],
      isError: true,
    };
  }

  const value =
    result.type === "object"
      ? JSON.stringify(result.value, null, 2)
      : String(result.value);

  return { content: [{ type: "text", text: value }] };
}
