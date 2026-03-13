#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { ChromeConnection } from "./chrome-connection.js";
import { TabFaviconManager } from "./tab-favicon-manager.js";
import { ExtensionBridge } from "./extension-bridge.js";
import { generateDescription, generateTabVerb } from "./description-generator.js";
import { tabsToolDefinition, handleTabs } from "./tools/tabs.js";
import { navigateToolDefinition, navigateBackToolDefinition, navigateForwardToolDefinition, reloadToolDefinition, handleNavigate, handleNavigateBack, handleNavigateForward, handleReload, } from "./tools/navigation.js";
import { snapshotToolDefinition, handleSnapshot } from "./tools/snapshot.js";
import { screenshotToolDefinition, handleScreenshot } from "./tools/screenshot.js";
import { evaluateToolDefinition, handleEvaluate } from "./tools/evaluate.js";
import { clickToolDefinition, typeToolDefinition, hoverToolDefinition, pressKeyToolDefinition, scrollToolDefinition, selectOptionToolDefinition, fillFormToolDefinition, waitForToolDefinition, handleClick, handleType, handleHover, handlePressKey, handleScroll, handleSelectOption, handleFillForm, handleWaitFor, } from "./tools/interaction.js";
import { devtoolsConsoleToolDefinition, handleDevtoolsConsole } from "./tools/devtools/console.js";
import { devtoolsNetworkToolDefinition, handleDevtoolsNetwork } from "./tools/devtools/network.js";
import { devtoolsElementsToolDefinition, handleDevtoolsElements } from "./tools/devtools/elements.js";
import { devtoolsStorageToolDefinition, handleDevtoolsStorage } from "./tools/devtools/storage.js";
import { chromeWindowsToolDefinition, chromeFocusToolDefinition, chromeExtensionsToolDefinition, handleChromeWindows, handleChromeFocus, handleChromeExtensions, } from "./tools/browser.js";
const DEBUG_PORT = parseInt(process.env.CHROME_DEBUG_PORT ?? "9222", 10);
const connection = new ChromeConnection(DEBUG_PORT);
const faviconManager = new TabFaviconManager();
const bridge = new ExtensionBridge(DEBUG_PORT);
const toolHandlers = {
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
];
const server = new Server({ name: "chrome-agent-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: allTools }));
const SKIP_FAVICON_ACTIONS = new Set(["list", "close", "switch", "done"]);
const NAVIGATION_TOOLS = new Set(["browser_navigate", "browser_navigate_back", "browser_navigate_forward", "browser_reload"]);
const STOP_DELAY_MS = 25000;
const DONE_RESTORE_DELAY_MS = 3000;
const stopTimers = new Map();
function scheduleStop(tabId, groupName) {
    const existing = stopTimers.get(tabId);
    if (existing)
        clearTimeout(existing);
    const timer = setTimeout(async () => {
        stopTimers.delete(tabId);
        await faviconManager.markDone(tabId, connection);
        bridge.log({ type: "tab_done", tool: "browser_tabs:stop", tabId, groupName, description: "inativo" });
        setTimeout(() => faviconManager.stopActivity(tabId, connection), DONE_RESTORE_DELAY_MS);
    }, STOP_DELAY_MS);
    stopTimers.set(tabId, timer);
}
function cancelStop(tabId) {
    const existing = stopTimers.get(tabId);
    if (existing) {
        clearTimeout(existing);
        stopTimers.delete(tabId);
    }
}
function extractNewTabId(result) {
    const text = result?.content?.[0]?.text ?? "";
    const match = text.match(/tabId=([A-F0-9]+)/);
    return match ? match[1] : null;
}
function extractScreenshot(result) {
    return result?.content?.[0]?.type === "image" ? result.content[0].data : undefined;
}
const SKIP_BRIDGE_ACTIONS = new Set(["list", "switch"]);
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    const handler = toolHandlers[name];
    if (!handler) {
        return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
    }
    const isTabsNew = name === "browser_tabs" && args.action === "new";
    const isTabsClose = name === "browser_tabs" && args.action === "close";
    const isTabsDone = name === "browser_tabs" && args.action === "done";
    const skipFavicon = name === "browser_tabs" && SKIP_FAVICON_ACTIONS.has(args.action);
    const isNavigation = NAVIGATION_TOOLS.has(name);
    const skipBridge = name === "browser_tabs" && SKIP_BRIDGE_ACTIONS.has(args.action);
    const groupName = connection.tabGroup.getGroupName();
    if (isTabsDone) {
        const doneTabId = args.tabId ?? connection.getActiveTabId();
        if (doneTabId) {
            cancelStop(doneTabId);
            await faviconManager.markDone(doneTabId, connection);
            setTimeout(() => faviconManager.stopActivity(doneTabId, connection), DONE_RESTORE_DELAY_MS);
            bridge.log({ type: "tab_done", tool: "browser_tabs:done", tabId: doneTabId, groupName, description: "finalizando tarefa" });
        }
        return { content: [{ type: "text", text: "Tab marked as done" }] };
    }
    const tabId = skipFavicon || isTabsNew
        ? null
        : (args.tabId ?? connection.getActiveTabId());
    if (tabId) {
        cancelStop(tabId);
        if (!isNavigation)
            await faviconManager.startActivity(tabId, connection);
    }
    if (tabId && !skipBridge) {
        const tabUrl = args.url;
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
    try {
        const result = (await handler(args, connection));
        if (isTabsNew) {
            const newTabId = extractNewTabId(result);
            if (newTabId) {
                faviconManager.startActivityAfterLoad(newTabId, connection);
                bridge.log({ type: "tab_open", tool: "browser_tabs:new", tabId: newTabId, groupName, description: generateDescription("browser_tabs:new", args), tabVerb: generateTabVerb("browser_tabs:new", args) });
            }
        }
        if (isNavigation && tabId)
            await faviconManager.startActivity(tabId, connection);
        if (isTabsClose && tabId) {
            cancelStop(tabId);
            await faviconManager.stopActivity(tabId, connection);
            bridge.log({ type: "tab_close", tool: "browser_tabs:close", tabId, groupName, description: "fechando tab" });
        }
        else if (tabId) {
            scheduleStop(tabId, groupName);
        }
        if (name === "browser_take_screenshot") {
            const screenshotData = extractScreenshot(result);
            if (screenshotData && tabId) {
                bridge.log({ type: "screenshot", tool: "browser_take_screenshot", tabId, groupName, screenshot: screenshotData });
            }
        }
        return result;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
    }
});
const transport = new StdioServerTransport();
await server.connect(transport);
