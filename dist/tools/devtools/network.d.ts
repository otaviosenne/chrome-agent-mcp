import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { ChromeConnection } from "../../core/connection.js";
import { ToolResult } from "../../types.js";
export declare const devtoolsNetworkToolDefinition: Tool;
export declare function handleDevtoolsNetwork(args: Record<string, unknown>, connection: ChromeConnection): Promise<ToolResult>;
