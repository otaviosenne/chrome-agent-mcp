import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { ChromeConnection } from "../../core/connection.js";
import { ToolResult } from "../../types.js";
export declare const devtoolsElementsToolDefinition: Tool;
export declare function handleDevtoolsElements(args: Record<string, unknown>, connection: ChromeConnection): Promise<ToolResult>;
