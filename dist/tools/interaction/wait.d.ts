import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { ChromeConnection } from "../../core/connection.js";
import { ToolResult } from "../../types.js";
export declare const waitForToolDefinition: Tool;
export declare function handleWaitFor(args: Record<string, unknown>, connection: ChromeConnection): Promise<ToolResult>;
