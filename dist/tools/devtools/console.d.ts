import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { ChromeConnection } from "../../chrome-connection.js";
import { ToolResult } from "../../types.js";
export declare const devtoolsConsoleToolDefinition: Tool;
export declare function handleDevtoolsConsole(args: Record<string, unknown>, connection: ChromeConnection): Promise<ToolResult>;
