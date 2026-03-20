import { ToolResult } from "../types.js";
import { ChromeConnection } from "./connection.js";
export declare function executeResilient(fn: () => Promise<ToolResult>, isIdempotent: boolean, onFallback: () => Promise<boolean>): Promise<ToolResult>;
export declare function openFallbackGroup(connection: ChromeConnection): Promise<boolean>;
