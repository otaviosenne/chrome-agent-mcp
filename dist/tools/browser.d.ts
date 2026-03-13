import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { ChromeConnection } from "../chrome-connection.js";
import { ToolResult } from "../types.js";
export declare const chromeWindowsToolDefinition: Tool;
export declare const chromeFocusToolDefinition: Tool;
export declare const chromeExtensionsToolDefinition: Tool;
export declare function handleChromeWindows(args: Record<string, unknown>, connection: ChromeConnection): Promise<ToolResult>;
export declare function handleChromeFocus(args: Record<string, unknown>, connection: ChromeConnection): Promise<ToolResult>;
export declare function handleChromeExtensions(_args: Record<string, unknown>, _connection: ChromeConnection): Promise<ToolResult>;
