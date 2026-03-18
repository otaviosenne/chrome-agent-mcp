import { appendFileSync, readFileSync, readdirSync, statSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { ChromeConnection } from "../core/connection.js";
import { ToolResult } from "../types.js";
import { claudeToChrome, chromeToClaude, VALID_CLAUDE_COLORS } from "../utils/identity.js";

export const sessionSyncToolDefinition = {
  name: "session_sync",
  description:
    "Sync Claude session name/color with Chrome tab group. " +
    "'rename': renames BOTH the Claude chat AND Chrome group automatically. " +
    "'color': maps a Claude Code color to Chrome group color and returns the /color command. " +
    "'detect': reads current Chrome group state and returns matching /rename + /color commands.",
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["rename", "color", "detect"],
        description:
          "rename: set new session name (syncs both) | color: sync theme color | detect: check Chrome group state",
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

export function getCurrentSessionPath(): string | null {
  return findCurrentSessionFile()?.file ?? null;
}

export function getCurrentSessionTitle(): string | null {
  try {
    const session = findCurrentSessionFile();
    if (!session) return null;
    const lines = readFileSync(session.file, "utf8").trim().split("\n");
    let title: string | null = null;
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.customTitle) title = entry.customTitle;
        else if (entry.agentName) title = entry.agentName;
      } catch {}
    }
    return title;
  } catch {
    return null;
  }
}

function findCurrentSessionFile(): { file: string; sessionId: string } | null {
  try {
    const projectsRoot = join(homedir(), ".claude", "projects");
    let best: { file: string; sessionId: string; mtime: number } | null = null;

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
      } catch {}
    }

    return best ? { file: best.file, sessionId: best.sessionId } : null;
  } catch {
    return null;
  }
}

export function renameClaudeSession(newTitle: string): boolean {
  try {
    const session = findCurrentSessionFile();
    if (!session) return false;
    const entry1 = JSON.stringify({ type: "custom-title", customTitle: newTitle, sessionId: session.sessionId });
    const entry2 = JSON.stringify({ type: "agent-name", agentName: newTitle, sessionId: session.sessionId });
    appendFileSync(session.file, `${entry1}\n${entry2}\n`);
    writeFileSync(join(homedir(), ".claude", ".pending_rename"), newTitle, "utf8");
    return true;
  } catch {
    return false;
  }
}

export function writeAutoSync(groupName: string, groupColor: string): void {
  if (!groupName) return;
  try {
    const claudeDir = join(homedir(), ".claude");
    const claudeColor = chromeToClaude(groupColor) ?? "default";
    writeFileSync(join(claudeDir, ".pending_rename"), groupName, "utf8");
    writeFileSync(join(claudeDir, ".pending_color"), claudeColor, "utf8");
    writeFileSync(join(claudeDir, ".pending_pid"), `mcp:${process.pid}`, "utf8");
  } catch {}
}

export async function handleSessionSync(
  args: Record<string, unknown>,
  connection: ChromeConnection
): Promise<ToolResult> {
  const action = args.action as string;
  const tabGroup = connection.tabGroup;

  if (action === "rename") {
    const raw = ((args.description as string | undefined) ?? "").trim().slice(0, 20);
    const groupNum = tabGroup.getGroupNumber();
    const newName = raw ? `#${groupNum} ${raw}` : `#${groupNum}`;

    const chromeOk = await tabGroup.renameGroup(newName);
    const claudeOk = renameClaudeSession(newName);

    const parts: string[] = [];
    if (claudeOk) parts.push(`Claude chat renamed to "${newName}"`);
    else parts.push(`Claude rename failed (run manually: /rename ${newName})`);
    if (chromeOk) parts.push(`Chrome group renamed to "${newName}"`);
    else parts.push(`Chrome group not reachable (no active tab group yet?)`);

    return { content: [{ type: "text", text: parts.join("\n") }] };
  }

  if (action === "color") {
    const claudeColor = ((args.claudeColor as string | undefined) ?? "").toLowerCase();
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
