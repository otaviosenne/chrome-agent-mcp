import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { ChromeConnection } from "../../core/connection.js";
import { ToolResult } from "../../types.js";

export const devtoolsStorageToolDefinition: Tool = {
  name: "devtools_storage",
  description:
    "Read or write browser storage for a tab: localStorage, sessionStorage, or cookies. Equivalent to DevTools Application > Storage panel.",
  inputSchema: {
    type: "object",
    properties: {
      storageType: {
        type: "string",
        enum: ["localStorage", "sessionStorage", "cookies"],
        description: "Which storage to access",
      },
      action: {
        type: "string",
        enum: ["list", "get", "set", "delete"],
        description: "list: all keys | get: value for a key | set: write a key | delete: remove a key",
      },
      key: {
        type: "string",
        description: "Storage key (required for get/set/delete)",
      },
      value: {
        type: "string",
        description: "Value to write (required for set)",
      },
      tabId: {
        type: "string",
        description: "Target tab ID (from browser_tabs list). Uses active tab if omitted.",
      },
    },
    required: ["storageType", "action"],
  },
};

export async function handleDevtoolsStorage(
  args: Record<string, unknown>,
  connection: ChromeConnection
): Promise<ToolResult> {
  const client = await connection.getClient(args.tabId as string | undefined);
  const storageType = args.storageType as string;
  const action = args.action as string;
  const key = args.key as string | undefined;
  const value = args.value as string | undefined;

  if (storageType === "cookies") {
    return handleCookies(client, action, key, value);
  }

  const storageObj = storageType === "localStorage" ? "localStorage" : "sessionStorage";

  if (action === "list") {
    const { result } = await client.Runtime.evaluate({
      expression: `JSON.stringify(Object.fromEntries(Object.keys(${storageObj}).map(k => [k, ${storageObj}.getItem(k)])))`,
      returnByValue: true,
    });
    const items = JSON.parse(result.value as string || "{}");
    const keys = Object.keys(items);
    if (keys.length === 0) return { content: [{ type: "text", text: `${storageType} is empty.` }] };
    const output = keys.map((k) => `  ${k}: ${String(items[k]).substring(0, 100)}`).join("\n");
    return { content: [{ type: "text", text: `${storageType} (${keys.length} keys):\n${output}` }] };
  }

  if (action === "get") {
    if (!key) return { content: [{ type: "text", text: "key is required for get" }], isError: true };
    const { result } = await client.Runtime.evaluate({
      expression: `${storageObj}.getItem(${JSON.stringify(key)})`,
      returnByValue: true,
    });
    return { content: [{ type: "text", text: result.value === null ? `Key not found: ${key}` : `${key} = ${result.value}` }] };
  }

  if (action === "set") {
    if (!key || value === undefined) return { content: [{ type: "text", text: "key and value are required for set" }], isError: true };
    await client.Runtime.evaluate({
      expression: `${storageObj}.setItem(${JSON.stringify(key)}, ${JSON.stringify(value)})`,
      returnByValue: true,
    });
    return { content: [{ type: "text", text: `Set ${storageType}.${key} = "${value}"` }] };
  }

  if (action === "delete") {
    if (!key) return { content: [{ type: "text", text: "key is required for delete" }], isError: true };
    await client.Runtime.evaluate({
      expression: `${storageObj}.removeItem(${JSON.stringify(key)})`,
      returnByValue: true,
    });
    return { content: [{ type: "text", text: `Deleted ${storageType}.${key}` }] };
  }

  return { content: [{ type: "text", text: `Unknown action: ${action}` }], isError: true };
}

const DEFAULT_COOKIE_PATH = "/";

async function resolveCurrentPageCookieDefaults(
  client: any
): Promise<{ domain: string; path: string }> {
  const { result } = await client.Runtime.evaluate({
    expression: "window.location.hostname",
    returnByValue: true,
  });
  return { domain: result.value as string, path: DEFAULT_COOKIE_PATH };
}

async function handleCookies(
  client: any,
  action: string,
  key: string | undefined,
  value: string | undefined
): Promise<{ content: Array<{ type: "text" | "image"; text?: string }> }> {
  if (action === "list") {
    const { cookies } = await client.Network.getCookies({});
    if (!cookies.length) return { content: [{ type: "text", text: "No cookies found." }] };
    const output = cookies
      .map((c: any) => `  ${c.name}=${String(c.value).substring(0, 80)} (${c.domain}${c.path})`)
      .join("\n");
    return { content: [{ type: "text", text: `Cookies (${cookies.length}):\n${output}` }] };
  }

  if (action === "get") {
    if (!key) return { content: [{ type: "text", text: "key is required for get" }] };
    const { cookies } = await client.Network.getCookies({});
    const cookie = cookies.find((c: any) => c.name === key);
    return { content: [{ type: "text", text: cookie ? `${key} = ${cookie.value}` : `Cookie not found: ${key}` }] };
  }

  if (action === "set") {
    if (!key || value === undefined) return { content: [{ type: "text", text: "key and value are required for set" }] };
    const { domain, path } = await resolveCurrentPageCookieDefaults(client);
    await client.Network.setCookie({ name: key, value, domain, path });
    return { content: [{ type: "text", text: `Set cookie ${key} = "${value}"` }] };
  }

  if (action === "delete") {
    if (!key) return { content: [{ type: "text", text: "key is required for delete" }] };
    const { domain, path } = await resolveCurrentPageCookieDefaults(client);
    await client.Network.deleteCookies({ name: key, domain, path });
    return { content: [{ type: "text", text: `Deleted cookie: ${key}` }] };
  }

  return { content: [{ type: "text", text: `Unknown action: ${action}` }] };
}
