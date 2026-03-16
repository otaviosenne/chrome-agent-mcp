import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { ChromeConnection } from "../../core/connection.js";
import { ToolResult } from "../../types.js";
export declare const scrollToolDefinition: Tool;
export declare const selectOptionToolDefinition: Tool;
export declare const fillFormToolDefinition: Tool;
export declare function handleScroll(args: Record<string, unknown>, connection: ChromeConnection): Promise<ToolResult>;
export declare function handleSelectOption(args: Record<string, unknown>, connection: ChromeConnection): Promise<ToolResult>;
export declare function handleFillForm(args: Record<string, unknown>, connection: ChromeConnection): Promise<ToolResult>;
