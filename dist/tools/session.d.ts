import { ChromeConnection } from "../core/connection.js";
import { ToolResult } from "../types.js";
export declare const sessionSyncToolDefinition: {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            action: {
                type: string;
                enum: string[];
                description: string;
            };
            description: {
                type: string;
                description: string;
            };
            claudeColor: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
};
export declare function getCurrentSessionPath(): string | null;
export declare function getCurrentSessionTitle(): string | null;
export declare function writeAutoSync(groupName: string, groupColor: string): void;
export declare function handleSessionSync(args: Record<string, unknown>, connection: ChromeConnection): Promise<ToolResult>;
