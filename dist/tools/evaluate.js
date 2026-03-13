export const evaluateToolDefinition = {
    name: "browser_evaluate",
    description: "Evaluate a JavaScript expression in a page context. Supports targeting a specific tab via tabId.",
    inputSchema: {
        type: "object",
        properties: {
            expression: {
                type: "string",
                description: "JavaScript expression or async function body to evaluate",
            },
            tabId: {
                type: "string",
                description: "Target tab ID (from browser_tabs list). Uses active tab if omitted.",
            },
        },
        required: ["expression"],
    },
};
export async function handleEvaluate(args, connection) {
    const client = await connection.getClient(args.tabId);
    const expression = args.expression;
    const { result, exceptionDetails } = await client.Runtime.evaluate({
        expression,
        returnByValue: true,
        awaitPromise: true,
    });
    if (exceptionDetails) {
        return {
            content: [{ type: "text", text: `JS Error: ${exceptionDetails.exception?.description || "Unknown error"}` }],
            isError: true,
        };
    }
    const value = result.type === "object"
        ? JSON.stringify(result.value, null, 2)
        : String(result.value);
    return { content: [{ type: "text", text: value }] };
}
