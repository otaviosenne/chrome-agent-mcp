#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { ChromeConnection } from "./core/connection.js";
import { TabFaviconManager } from "./core/favicon.js";
import { ExtensionBridge } from "./core/bridge.js";
import { generateDescription, generateTabVerb } from "./utils/description.js";
import { chromeToClaude } from "./utils/identity.js";
import { ToolResult } from "./types.js";

import { tabsToolDefinition, handleTabs } from "./tools/tabs.js";
import {
  navigateToolDefinition, navigateBackToolDefinition,
  navigateForwardToolDefinition, reloadToolDefinition,
  handleNavigate, handleNavigateBack, handleNavigateForward, handleReload,
} from "./tools/navigation.js";
import {
  snapshotToolDefinition, screenshotToolDefinition, evaluateToolDefinition,
  handleSnapshot, handleScreenshot, handleEvaluate,
} from "./tools/media.js";
import {
  clickToolDefinition, typeToolDefinition, hoverToolDefinition,
  pressKeyToolDefinition, scrollToolDefinition, selectOptionToolDefinition,
  fillFormToolDefinition, waitForToolDefinition,
  handleClick, handleType, handleHover, handlePressKey,
  handleScroll, handleSelectOption, handleFillForm, handleWaitFor,
} from "./tools/interaction/index.js";
import { devtoolsConsoleToolDefinition, handleDevtoolsConsole } from "./tools/devtools/console.js";
import { devtoolsNetworkToolDefinition, handleDevtoolsNetwork } from "./tools/devtools/network.js";
import { devtoolsElementsToolDefinition, handleDevtoolsElements } from "./tools/devtools/elements.js";
import { devtoolsStorageToolDefinition, handleDevtoolsStorage } from "./tools/devtools/storage.js";
import {
  chromeWindowsToolDefinition, chromeFocusToolDefinition, chromeExtensionsToolDefinition,
  handleChromeWindows, handleChromeFocus, handleChromeExtensions,
} from "./tools/browser.js";
import { sessionSyncToolDefinition, handleSessionSync, writeAutoSync, getCurrentSessionPath, getCurrentSessionTitle } from "./tools/session.js";
import { executeResilient, openFallbackGroup } from "./core/resilience.js";

const DEBUG_PORT = parseInt(process.env.CHROME_DEBUG_PORT ?? "9222", 10);
const connection = new ChromeConnection(DEBUG_PORT);
const faviconManager = new TabFaviconManager();
const bridge = new ExtensionBridge(DEBUG_PORT);

let lastSyncedSessionPath: string | null = null;
let lastWrittenAutoSyncGroup: string | null = null;
const agentBindings = new Map<string, string>();

async function autoSyncOnce(): Promise<void> {
  const currentPath = getCurrentSessionPath();
  if (!currentPath || currentPath === lastSyncedSessionPath) return;
  lastSyncedSessionPath = currentPath;
  if (connection.tabGroup.hasOwnedTabs()) return;
  await connection.tabGroup.resetForNewSession();
  await connection.tabGroup.initialize();
  const name = connection.tabGroup.getGroupName();
  const color = connection.tabGroup.getGroupColor();
  if (!name) return;
  const currentTitle = getCurrentSessionTitle(currentPath);
  if (currentTitle !== name) {
    lastWrittenAutoSyncGroup = name;
    writeAutoSync(name, color);
  }
}

const toolHandlers: Record<string, (args: Record<string, unknown>, conn: ChromeConnection) => Promise<ToolResult>> = {
  browser_tabs: handleTabs,
  browser_navigate: handleNavigate,
  browser_navigate_back: handleNavigateBack,
  browser_navigate_forward: handleNavigateForward,
  browser_reload: handleReload,
  browser_snapshot: handleSnapshot,
  browser_take_screenshot: handleScreenshot,
  browser_evaluate: handleEvaluate,
  browser_click: handleClick,
  browser_type: handleType,
  browser_hover: handleHover,
  browser_press_key: handlePressKey,
  browser_scroll: handleScroll,
  browser_select_option: handleSelectOption,
  browser_fill_form: handleFillForm,
  browser_wait_for: handleWaitFor,
  devtools_console: handleDevtoolsConsole,
  devtools_network: handleDevtoolsNetwork,
  devtools_elements: handleDevtoolsElements,
  devtools_storage: handleDevtoolsStorage,
  chrome_windows: handleChromeWindows,
  chrome_focus: handleChromeFocus,
  chrome_extensions: handleChromeExtensions,
  session_sync: handleSessionSync,
};

const allTools = [
  tabsToolDefinition,
  navigateToolDefinition, navigateBackToolDefinition,
  navigateForwardToolDefinition, reloadToolDefinition,
  snapshotToolDefinition, screenshotToolDefinition,
  evaluateToolDefinition,
  clickToolDefinition, typeToolDefinition, hoverToolDefinition,
  pressKeyToolDefinition, scrollToolDefinition, selectOptionToolDefinition,
  fillFormToolDefinition, waitForToolDefinition,
  devtoolsConsoleToolDefinition, devtoolsNetworkToolDefinition,
  devtoolsElementsToolDefinition, devtoolsStorageToolDefinition,
  chromeWindowsToolDefinition, chromeFocusToolDefinition, chromeExtensionsToolDefinition,
  sessionSyncToolDefinition,
];

const server = new Server(
  { name: "chrome-agent-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: allTools }));

const IDEMPOTENT_TOOLS = new Set([
  "browser_snapshot",
  "browser_take_screenshot",
  "browser_evaluate",
  "devtools_console",
  "devtools_network",
  "devtools_elements",
  "devtools_storage",
  "chrome_windows",
  "chrome_extensions",
  "session_sync",
]);

const TOOLS_INDEPENDENT_OF_TAB = new Set([
  "browser_tabs",
  "browser_navigate",
  "chrome_windows",
  "chrome_focus",
  "chrome_extensions",
  "session_sync",
]);

function isIdempotentCall(name: string, args: Record<string, unknown>): boolean {
  if (IDEMPOTENT_TOOLS.has(name)) return true;
  if (name === "browser_tabs" && args.action === "list") return true;
  return false;
}

const SKIP_FAVICON_ACTIONS = new Set(["list", "close", "switch", "done"]);
const NAVIGATION_TOOLS = new Set(["browser_navigate", "browser_navigate_back", "browser_navigate_forward", "browser_reload"]);
const STOP_DELAY_MS = 25000;
const BLANK_TAB_STOP_DELAY_MS = 2000;

const stopTimers = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleStop(tabId: string, groupName: string, delayMs: number = STOP_DELAY_MS): void {
  const existing = stopTimers.get(tabId);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(async () => {
    stopTimers.delete(tabId);
    await faviconManager.markDone(tabId, connection);
    bridge.log({ type: "tab_done", tool: "browser_tabs:stop", tabId, groupName, description: "inativo" });
  }, delayMs);
  stopTimers.set(tabId, timer);
}

function scheduleBlankTabClose(tabId: string): void {
  setTimeout(async () => {
    try {
      const targets = await (connection as any).listTabs();
      const tab = targets.find((t: any) => t.id === tabId);
      if (tab && (tab.url === "about:blank" || tab.url === "")) {
        await connection.closeTab(tabId);
      }
    } catch {}
  }, BLANK_TAB_STOP_DELAY_MS + 500);
}

function cancelStop(tabId: string): void {
  const existing = stopTimers.get(tabId);
  if (existing) {
    clearTimeout(existing);
    stopTimers.delete(tabId);
  }
}

function extractNewTabId(result: any): string | null {
  const text: string = result?.content?.[0]?.text ?? "";
  const match = text.match(/tabId=([A-F0-9]+)/);
  return match ? match[1] : null;
}

function extractScreenshot(result: any): string | undefined {
  return result?.content?.[0]?.type === "image" ? result.content[0].data : undefined;
}

const SKIP_BRIDGE_ACTIONS = new Set(["list", "switch"]);

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  await autoSyncOnce();
  const { name, arguments: rawArgs = {} } = request.params;
  const agentId = rawArgs.agentId as string | undefined;
  const args: Record<string, unknown> = agentId && !rawArgs.tabId
    ? { ...rawArgs, tabId: agentBindings.get(agentId) }
    : { ...rawArgs };
  const handler = toolHandlers[name];

  if (!handler) {
    return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true } as any;
  }

  const isTabsNew = name === "browser_tabs" && args.action === "new";
  const isTabsClose = name === "browser_tabs" && args.action === "close";
  const isTabsDone = name === "browser_tabs" && args.action === "done";
  const skipFavicon = name === "browser_tabs" && SKIP_FAVICON_ACTIONS.has(args.action as string);
  const isNavigation = NAVIGATION_TOOLS.has(name);
  const skipBridge = name === "browser_tabs" && SKIP_BRIDGE_ACTIONS.has(args.action as string);
  const groupName = connection.tabGroup.getGroupName();

  if (isTabsDone) {
    const doneTabId = (args.tabId as string | undefined) ?? connection.getActiveTabId();
    if (doneTabId) {
      cancelStop(doneTabId);
      await faviconManager.markDone(doneTabId, connection);
      bridge.log({ type: "tab_done", tool: "browser_tabs:done", tabId: doneTabId, groupName, description: "finalizando tarefa" });
    }
    return { content: [{ type: "text", text: "Tab marked as done" }] } as any;
  }

  const tabId = skipFavicon || isTabsNew
    ? null
    : ((args.tabId as string | undefined) ?? connection.getActiveTabId());

  if (tabId) {
    cancelStop(tabId);
    if (!isNavigation) await faviconManager.startActivity(tabId, connection);
  }

  if (tabId && !skipBridge) {
    const tabUrl = args.url as string | undefined;
    bridge.log({
      type: "tab_active",
      tool: name + (args.action ? `:${args.action}` : ""),
      tabId,
      tabUrl,
      groupName,
      description: generateDescription(name, args, tabUrl),
      tabVerb: generateTabVerb(name, args, tabUrl),
    });
  }

  if (!TOOLS_INDEPENDENT_OF_TAB.has(name) && !connection.tabGroup.hasOwnedTabs()) {
    return {
      content: [{ type: "text", text: "No active tab — use browser_navigate with a URL to start browsing." }],
      isError: true,
    } as any;
  }

  try {
    const isIdempotent = isIdempotentCall(name, args as Record<string, unknown>);
    const savedGroupName = connection.tabGroup.getGroupName();
    const result = (await executeResilient(
      () => handler(args as Record<string, unknown>, connection),
      isIdempotent,
      async () => {
        const opened = await openFallbackGroup(connection);
        if (savedGroupName) await connection.tabGroup.renameGroup(savedGroupName);
        return opened;
      }
    )) as any;

    const createdTabId = extractNewTabId(result);
    if (createdTabId && agentId) agentBindings.set(agentId, createdTabId);
    if (createdTabId && (isTabsNew || name === "browser_navigate")) {
      const createdGroupName = connection.tabGroup.getGroupName();
      const hasUrl = !!(args.url as string | undefined);
      faviconManager.startActivityAfterLoad(createdTabId, connection);
      scheduleStop(createdTabId, createdGroupName, hasUrl ? STOP_DELAY_MS : BLANK_TAB_STOP_DELAY_MS);
      if (!hasUrl) scheduleBlankTabClose(createdTabId);
      bridge.log({ type: "tab_open", tool: isTabsNew ? "browser_tabs:new" : "browser_navigate", tabId: createdTabId, tabUrl: args.url as string | undefined, groupName: createdGroupName, description: generateDescription(name, args, args.url as string | undefined), tabVerb: generateTabVerb(name, args, args.url as string | undefined) });
      const groupColor = connection.tabGroup.getGroupColor();
      const claudeColor = chromeToClaude(groupColor) ?? "default";
      if (createdGroupName !== lastWrittenAutoSyncGroup) {
        lastWrittenAutoSyncGroup = createdGroupName;
        writeAutoSync(createdGroupName, groupColor);
        if (result?.content?.[0]?.type === "text" && typeof result.content[0].text === "string") {
          result.content[0].text += `\n/rename ${createdGroupName}\n/color ${claudeColor}`;
        }
      }
    }

    if (isNavigation && tabId) await faviconManager.startActivity(tabId, connection);

    if (isTabsClose && tabId) {
      cancelStop(tabId);
      await faviconManager.stopActivity(tabId, connection);
      bridge.log({ type: "tab_close", tool: "browser_tabs:close", tabId, groupName, description: "fechando tab" });
      if (agentId) agentBindings.delete(agentId);
      if (!connection.tabGroup.hasOwnedTabs()) lastWrittenAutoSyncGroup = null;
    } else if (tabId) {
      scheduleStop(tabId, groupName);
    }

    if (name === "browser_take_screenshot") {
      const screenshotData = extractScreenshot(result);
      if (screenshotData && tabId) {
        bridge.log({ type: "screenshot", tool: "browser_take_screenshot", tabId, groupName, groupColor: connection.tabGroup.getGroupColor(), screenshot: screenshotData });
      }
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { content: [{ type: "text", text: `Error: ${message}` }], isError: true } as any;
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);

const sendHeartbeat = () => {
  bridge.log({ type: "session_alive", tool: "heartbeat", groupName: connection.tabGroup.getGroupName() });
};
bridge.setOnConnected(sendHeartbeat);
sendHeartbeat();
setInterval(sendHeartbeat, 15000);
