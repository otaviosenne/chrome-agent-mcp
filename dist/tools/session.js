import { claudeToChrome, chromeToClaude, VALID_CLAUDE_COLORS } from "../color-mapper.js";
export const sessionSyncToolDefinition = {
    name: "session_sync",
    description: "Sync Claude session name/color with Chrome tab group. " +
        "'rename': renames Chrome group to '#N description' format and returns the /rename command. " +
        "'color': maps a Claude Code color to Chrome group color and returns the /color command. " +
        "'detect': reads current Chrome group state and returns matching /rename + /color commands.",
    inputSchema: {
        type: "object",
        properties: {
            action: {
                type: "string",
                enum: ["rename", "color", "detect"],
                description: "rename: set new session name | color: sync theme color | detect: check Chrome group state",
            },
            description: {
                type: "string",
                description: "For 'rename': short goal description, max 20 chars (e.g. 'fix chrome mcp')",
            },
            claudeColor: {
                type: "string",
                description: `For 'color': Claude Code color name. Valid: ${VALID_CLAUDE_COLORS.join(", ")}`,
            },
        },
        required: ["action"],
    },
};
export async function handleSessionSync(args, connection) {
    const action = args.action;
    const tabGroup = connection.tabGroup;
    if (action === "rename") {
        const raw = (args.description ?? "").trim().slice(0, 20);
        const groupNum = tabGroup.getGroupNumber();
        const newName = raw ? `#${groupNum} ${raw}` : `#${groupNum}`;
        const success = await tabGroup.renameGroup(newName);
        const text = success
            ? `Chrome group renamed to "${newName}".\nTo complete sync, run: /rename ${newName}`
            : `Could not reach Chrome group (no active tab group yet?).\nTo sync Claude side anyway, run: /rename ${newName}`;
        return { content: [{ type: "text", text }] };
    }
    if (action === "color") {
        const claudeColor = (args.claudeColor ?? "").toLowerCase();
        const chromeColor = claudeToChrome(claudeColor);
        if (!chromeColor) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Unknown Claude color: "${claudeColor}". Valid: ${VALID_CLAUDE_COLORS.join(", ")}`,
                    },
                ],
            };
        }
        const success = await tabGroup.setGroupColor(chromeColor);
        const text = success
            ? `Chrome group color set to ${chromeColor}.\nTo complete sync, run: /color ${claudeColor}`
            : `Could not update Chrome group color.\nTo sync Claude side anyway, run: /color ${claudeColor}`;
        return { content: [{ type: "text", text }] };
    }
    if (action === "detect") {
        const state = await tabGroup.getGroupState();
        const claudeColor = chromeToClaude(state.color) ?? state.color;
        const lines = [
            `Chrome group: "${state.name}" | color: ${state.color}`,
            `Commands to match Claude session:`,
            `/rename ${state.name}`,
            `/color ${claudeColor}`,
        ];
        return { content: [{ type: "text", text: lines.join("\n") }] };
    }
    return { content: [{ type: "text", text: `Unknown action: ${action}` }] };
}
