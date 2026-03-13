import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { ChromeConnection } from "../../chrome-connection.js";
import { ToolResult } from "../../types.js";
export declare const devtoolsStorageToolDefinition: Tool;
export declare function handleDevtoolsStorage(args: Record<string, unknown>, connection: ChromeConnection): Promise<ToolResult>;
