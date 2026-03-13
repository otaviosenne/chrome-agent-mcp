import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { ChromeConnection } from "../chrome-connection.js";
import { ToolResult } from "../types.js";
export declare const evaluateToolDefinition: Tool;
export declare function handleEvaluate(args: Record<string, unknown>, connection: ChromeConnection): Promise<ToolResult>;
