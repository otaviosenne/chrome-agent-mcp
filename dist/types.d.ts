export interface TabInfo {
    id: string;
    title: string;
    url: string;
    type: string;
    webSocketDebuggerUrl: string;
}
export interface AXNode {
    nodeId: string;
    backendDOMNodeId?: number;
    ignored?: boolean;
    role?: {
        value: string;
    };
    name?: {
        value: string;
    };
    description?: {
        value: string;
    };
    value?: {
        value: string | number | boolean;
    };
    properties?: Array<{
        name: string;
        value: {
            value: unknown;
        };
    }>;
    childIds?: string[];
}
export interface ToolResult {
    content: Array<{
        type: "text" | "image";
        text?: string;
        data?: string;
        mimeType?: string;
    }>;
    isError?: boolean;
}
export interface NetworkRequest {
    requestId: string;
    method: string;
    url: string;
    resourceType: string;
    status?: number;
    statusText?: string;
    requestHeaders?: Record<string, string>;
    responseHeaders?: Record<string, string>;
    startTime: number;
    duration?: number;
}
export interface ConsoleEntry {
    level: string;
    text: string;
    url?: string;
    line?: number;
    timestamp: number;
}
