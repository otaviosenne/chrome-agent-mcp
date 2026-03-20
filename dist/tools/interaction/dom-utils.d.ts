import { ToolResult } from "../../types.js";
export declare function resolveElement(client: any, ref: number): Promise<{
    object: {
        objectId: string;
    };
}>;
export declare function getElementCenter(client: any, ref: number): Promise<{
    x: number;
    y: number;
}>;
export declare function buildFieldResults(results: {
    ref: number;
    success: boolean;
    error?: string;
}[]): ToolResult;
