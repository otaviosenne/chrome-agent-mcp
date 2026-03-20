import { broadcastToPopups, broadcastEvent } from "./events.js";
import { setRobotIcon, startIconAnimation, stopIconAnimation } from "./icon.js";

export const MAX_EVENTS = 500;
export const MAX_SCREENSHOTS = 20;
export const SESSION_TTL_MS = 5 * 60 * 1000;

const STORAGE_SIZE_LIMIT_BYTES = 3 * 1024 * 1024;

export let events = [];
export let activeTabs = new Map();
export let groups = new Map();
export let descriptions = new Map();
export let chromeGroups = new Map();
export let sessionLastAlive = new Map();
export let popupPorts = [];

export function setPopupPorts(ports) {
  popupPorts = ports;
}

async function persistActiveTabs() {
  try {
    await chrome.storage.local.set({
      activeTabs: Object.fromEntries(activeTabs),
      groups: Object.fromEntries(groups),
      descriptions: Object.fromEntries(descriptions),
    });
  } catch {}
}

async function persistEvents() {
  try {
    const toSave = events.slice();
    let serialized = JSON.stringify(toSave);
    while (serialized.length > STORAGE_SIZE_LIMIT_BYTES) {
      let removed = false;
      for (let i = toSave.length - 1; i >= 0; i--) {
        if (toSave[i].screenshot) {
          toSave[i] = { ...toSave[i], screenshot: null };
          removed = true;
          break;
        }
      }
      if (!removed) break;
      serialized = JSON.stringify(toSave);
    }
    await chrome.storage.local.set({ events: toSave });
  } catch {}
}

async function restoreActiveTabs() {
  try {
    const stored = await chrome.storage.local.get(["activeTabs", "groups", "descriptions", "events"]);
    if (stored.activeTabs) {
      for (const [k, v] of Object.entries(stored.activeTabs)) activeTabs.set(k, v);
    }
    if (stored.groups) {
      for (const [k, v] of Object.entries(stored.groups)) groups.set(k, v);
    }
    if (stored.descriptions) {
      for (const [k, v] of Object.entries(stored.descriptions)) descriptions.set(k, v);
    }
    if (Array.isArray(stored.events)) {
      events = stored.events;
    }
  } catch {}
}

const RESTORE_TTL_MS = 5 * 60 * 1000;

async function restoreSessionAlive() {
  try {
    const [session, local] = await Promise.all([
      chrome.storage.session.get(["sessionLastAlive"]),
      chrome.storage.local.get(["sessionLastAlive"]),
    ]);
    const stored = session.sessionLastAlive || local.sessionLastAlive;
    if (stored) {
      const now = Date.now();
      for (const [k, v] of Object.entries(stored)) {
        if (now - v < RESTORE_TTL_MS) sessionLastAlive.set(k, now);
      }
    }
  } catch {}
}

export async function persistSessionAlive() {
  try {
    const data = { sessionLastAlive: Object.fromEntries(sessionLastAlive) };
    await Promise.all([
      chrome.storage.session.set(data),
      chrome.storage.local.set(data),
    ]);
  } catch {}
}

export const restorePromise = Promise.all([restoreActiveTabs(), restoreSessionAlive()]);

export function getAliveSessions() {
  const now = Date.now();
  return [...sessionLastAlive.entries()]
    .filter(([, ts]) => now - ts < SESSION_TTL_MS)
    .map(([sid]) => sid);
}

export function cleanupDeadSessionTabs() {
  const now = Date.now();
  let changed = false;
  for (const [tabId, info] of activeTabs) {
    const sid = info.sessionId;
    if (sid && (!sessionLastAlive.has(sid) || now - sessionLastAlive.get(sid) > SESSION_TTL_MS)) {
      activeTabs.delete(tabId);
      changed = true;
    }
  }
  if (changed) persistActiveTabs();
}

export function enforceScreenshotLimit() {
  let count = 0;
  for (let i = 0; i < events.length; i++) {
    if (events[i].type === "screenshot" && events[i].screenshot) {
      count++;
      if (count > MAX_SCREENSHOTS) {
        events[i] = { ...events[i], screenshot: null };
      }
    }
  }
}

export async function buildChromeTabs() {
  const result = {};
  try {
    const tabs = await chrome.tabs.query({});
    for (const [title, data] of chromeGroups) {
      const groupTabs = tabs.filter(t => t.groupId === data.chromeGroupId);
      result[title] = groupTabs.map(t => ({ url: t.url || "", title: t.title || "", tabId: t.id }));
    }
  } catch {}
  return result;
}

export function buildStatePayload() {
  return {
    type: "state",
    events,
    activeTabs: Object.fromEntries(activeTabs),
    groups: Object.fromEntries(groups),
    descriptions: Object.fromEntries(descriptions),
    chromeGroups: Object.fromEntries(chromeGroups),
    aliveSessions: getAliveSessions(),
  };
}

export async function buildStatePayloadFull() {
  const base = buildStatePayload();
  base.chromeTabs = await buildChromeTabs();
  return base;
}

export function initState() {
  setRobotIcon(false);
  injectIntoExistingTabs();
}

self.__mcpLogEvent = async function (eventJson) {
  await restorePromise;
  let parsed;
  try {
    parsed = typeof eventJson === "string" ? JSON.parse(eventJson) : eventJson;
  } catch {
    return;
  }

  const event = {
    ...parsed,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  };

  if (event.type === "tab_active" || event.type === "tab_open") {
    const existing = activeTabs.get(event.tabId) || {};
    activeTabs.set(event.tabId, {
      url: event.tabUrl || existing.url || "",
      title: event.tabTitle || existing.title || "",
      groupName: event.groupName,
      sessionId: event.sessionId,
      tabVerb: event.tabVerb || existing.tabVerb || "",
      lastActivity: Date.now(),
    });
    persistActiveTabs();
  } else if (event.type === "tab_close" || event.type === "tab_done") {
    activeTabs.delete(event.tabId);
    persistActiveTabs();
  }

  if (event.type === "session_alive") {
    if (event.sessionId) {
      sessionLastAlive.set(event.sessionId, Date.now());
      persistSessionAlive();
      cleanupDeadSessionTabs();
    }
    events.unshift(event);
    if (events.length > MAX_EVENTS) events.length = MAX_EVENTS;
    persistEvents();
    broadcastToPopups({
      type: "event",
      event,
      activeTabs: Object.fromEntries(activeTabs),
      groups: Object.fromEntries(groups),
      descriptions: Object.fromEntries(descriptions),
      chromeGroups: Object.fromEntries(chromeGroups),
      aliveSessions: getAliveSessions(),
    });
    return;
  }

  if (event.sessionId) {
    sessionLastAlive.set(event.sessionId, Date.now());
    persistSessionAlive();
  }

  if (event.groupName && event.sessionId) {
    groups.set(event.groupName, event.sessionId);
  }

  if (event.groupName && event.description && event.type !== "tab_done" && event.type !== "tab_close") {
    descriptions.set(event.groupName, event.description);
    persistActiveTabs();
  }

  events.unshift(event);
  if (events.length > MAX_EVENTS) events.length = MAX_EVENTS;
  persistEvents();

  if (event.type === "screenshot") {
    enforceScreenshotLimit();
  }

  if (activeTabs.size > 0) {
    startIconAnimation();
  } else {
    stopIconAnimation();
  }

  broadcastEvent(event);
};

self.__getMcpState = function () {
  return JSON.stringify({
    events,
    activeTabs: Object.fromEntries(activeTabs),
    groups: Object.fromEntries(groups),
    descriptions: Object.fromEntries(descriptions),
  });
};

async function injectIntoExistingTabs() {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (!tab.id || tab.url?.startsWith("chrome://") || tab.url?.startsWith("chrome-extension://")) continue;
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    } catch {}
  }
}
