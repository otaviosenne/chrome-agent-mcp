import { appendFileSync, readdirSync, statSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { claudeToChrome, chromeToClaude, VALID_CLAUDE_COLORS } from "../color-mapper.js";
export const sessionSyncToolDefinition = {
    name: "session_sync",
    description: "Sync Claude session name/color with Chrome tab group. " +
        "'rename': renames BOTH the Claude chat AND Chrome group automatically. " +
        "'color': maps a Claude Code color to Chrome group color and returns the /color command. " +
        "'detect': reads current Chrome group state and returns matching /rename + /color commands.",
    inputSchema: {
        type: "object",
        properties: {
            action: {
                type: "string",
                enum: ["rename", "color", "detect"],
                description: "rename: set new session name (syncs both) | color: sync theme color | detect: check Chrome group state",
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
function findCurrentSessionFile() {
    try {
        const projectsRoot = join(homedir(), ".claude", "projects");
        let best = null;
        for (const projectDir of readdirSync(projectsRoot)) {
            const dir = join(projectsRoot, projectDir);
            try {
                for (const f of readdirSync(dir).filter((f) => f.endsWith(".jsonl"))) {
                    const file = join(dir, f);
                    const mtime = statSync(file).mtimeMs;
                    if (!best || mtime > best.mtime) {
                        best = { file, sessionId: f.replace(".jsonl", ""), mtime };
                    }
                }
            }
            catch { }
        }
        return best ? { file: best.file, sessionId: best.sessionId } : null;
    }
    catch {
        return null;
    }
}
function renameClaudeSession(newTitle) {
    try {
        const session = findCurrentSessionFile();
        if (!session)
            return false;
        const entry1 = JSON.stringify({ type: "custom-title", customTitle: newTitle, sessionId: session.sessionId });
        const entry2 = JSON.stringify({ type: "agent-name", agentName: newTitle, sessionId: session.sessionId });
        appendFileSync(session.file, `${entry1}\n${entry2}\n`);
        return true;
    }
    catch {
        return false;
    }
}
export async function handleSessionSync(args, connection) {
    const action = args.action;
    const tabGroup = connection.tabGroup;
    if (action === "rename") {
        const raw = (args.description ?? "").trim().slice(0, 20);
        const groupNum = tabGroup.getGroupNumber();
        const newName = raw ? `#${groupNum} ${raw}` : `#${groupNum}`;
        const chromeOk = await tabGroup.renameGroup(newName);
        const claudeOk = renameClaudeSession(newName);
        const parts = [];
        if (claudeOk)
            parts.push(`Claude chat renamed to "${newName}"`);
        else
            parts.push(`Claude rename failed (run manually: /rename ${newName})`);
        if (chromeOk)
            parts.push(`Chrome group renamed to "${newName}"`);
        else
            parts.push(`Chrome group not reachable (no active tab group yet?)`);
        return { content: [{ type: "text", text: parts.join("\n") }] };
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
            ? `Chrome group color set to ${chromeColor}.\nTo sync Claude theme, run: /color ${claudeColor}`
            : `Could not update Chrome group color.\nTo sync Claude theme, run: /color ${claudeColor}`;
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
