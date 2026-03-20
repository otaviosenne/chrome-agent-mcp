import { readFileSync, readdirSync, statSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { claudeToChrome, chromeToClaude, VALID_CLAUDE_COLORS } from "../utils/identity.js";
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
export function getCurrentSessionPath() {
    return findCurrentSessionFile()?.file ?? null;
}
export function getCurrentSessionTitle(sessionPath) {
    try {
        const filePath = sessionPath ?? findCurrentSessionFile()?.file;
        if (!filePath)
            return null;
        const lines = readFileSync(filePath, "utf8").trim().split("\n");
        let title = null;
        for (const line of lines) {
            try {
                const entry = JSON.parse(line);
                if (entry.customTitle)
                    title = entry.customTitle;
                else if (entry.agentName)
                    title = entry.agentName;
            }
            catch { }
        }
        return title;
    }
    catch {
        return null;
    }
}
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
function findAncestorKittyPid() {
    try {
        let pid = process.pid;
        while (pid > 1) {
            const status = readFileSync(`/proc/${pid}/status`, "utf8");
            const match = status.match(/^PPid:\s+(\d+)/m);
            if (!match)
                break;
            const ppid = parseInt(match[1], 10);
            const comm = readFileSync(`/proc/${ppid}/comm`, "utf8").trim();
            if (comm === "kitty")
                return String(ppid);
            pid = ppid;
        }
        return null;
    }
    catch {
        return null;
    }
}
export function writeAutoSync(groupName, groupColor) {
    if (!groupName)
        return;
    try {
        const claudeDir = join(homedir(), ".claude");
        const claudeColor = chromeToClaude(groupColor) ?? "default";
        const kittyPid = findAncestorKittyPid() ?? process.env.KITTY_PID;
        const pidPayload = kittyPid ? `kitty:${kittyPid}` : `mcp:${process.pid}`;
        writeFileSync(join(claudeDir, ".pending_rename"), groupName, "utf8");
        writeFileSync(join(claudeDir, ".pending_color"), claudeColor, "utf8");
        writeFileSync(join(claudeDir, ".pending_pid"), pidPayload, "utf8");
    }
    catch { }
}
export async function handleSessionSync(args, connection) {
    const action = args.action;
    const tabGroup = connection.tabGroup;
    if (action === "rename") {
        const raw = (args.description ?? "").trim().slice(0, 20);
        const groupNum = tabGroup.getGroupNumber();
        const newName = raw ? `#${groupNum} ${raw}` : `#${groupNum}`;
        const chromeOk = await tabGroup.renameGroup(newName);
        const parts = [];
        if (chromeOk)
            parts.push(`Chrome group renamed to "${newName}"`);
        else
            parts.push(`Chrome group not reachable (no active tab group yet?)`);
        parts.push(`/rename ${newName}`);
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
        writeFileSync(join(homedir(), ".claude", ".pending_color"), claudeColor, "utf8");
        const text = success
            ? `Chrome group color set to ${chromeColor}. Claude theme will sync to ${claudeColor}.`
            : `Could not update Chrome group color. Claude theme will sync to ${claudeColor}.`;
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
