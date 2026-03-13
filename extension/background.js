const MAX_EVENTS = 500;
const MAX_SCREENSHOTS = 20;

const SESSION_TTL_MS = 15000;

let events = [];
let activeTabs = new Map();
let groups = new Map();
let descriptions = new Map();
let chromeGroups = new Map();
let sessionLastAlive = new Map();
let popupPorts = [];

async function persistActiveTabs() {
  try {
    await chrome.storage.local.set({
      activeTabs: Object.fromEntries(activeTabs),
      groups: Object.fromEntries(groups),
      descriptions: Object.fromEntries(descriptions),
    });
  } catch {}
}

async function restoreActiveTabs() {
  try {
    const stored = await chrome.storage.local.get(["activeTabs", "groups", "descriptions"]);
    if (stored.activeTabs) {
      for (const [k, v] of Object.entries(stored.activeTabs)) activeTabs.set(k, v);
    }
    if (stored.groups) {
      for (const [k, v] of Object.entries(stored.groups)) groups.set(k, v);
    }
    if (stored.descriptions) {
      for (const [k, v] of Object.entries(stored.descriptions)) descriptions.set(k, v);
    }
  } catch {}
}

async function restoreSessionAlive() {
  try {
    const stored = await chrome.storage.session.get(["sessionLastAlive"]);
    if (stored.sessionLastAlive) {
      const now = Date.now();
      for (const [k, v] of Object.entries(stored.sessionLastAlive)) {
        if (now - v < SESSION_TTL_MS) sessionLastAlive.set(k, v);
      }
    }
  } catch {}
}

async function persistSessionAlive() {
  try {
    await chrome.storage.session.set({ sessionLastAlive: Object.fromEntries(sessionLastAlive) });
  } catch {}
}

restoreActiveTabs();
restoreSessionAlive();

function isClaudeGroup(title) {
  return /^(CLAUDE )?#\d+/.test(title || "");
}

async function initChromeGroups() {
  try {
    const existing = await chrome.tabGroups.query({});
    for (const g of existing) {
      if (isClaudeGroup(g.title)) {
        chromeGroups.set(g.title, { chromeGroupId: g.id, color: g.color });
      }
    }
    broadcastChromeGroups();
  } catch {}
}

function broadcastChromeGroups() {
  const payload = { type: "chrome_groups", chromeGroups: Object.fromEntries(chromeGroups) };
  popupPorts = popupPorts.filter(port => {
    try { port.postMessage(payload); return true; } catch { return false; }
  });
}

chrome.tabGroups.onCreated.addListener(g => {
  if (isClaudeGroup(g.title)) {
    chromeGroups.set(g.title, { chromeGroupId: g.id, color: g.color });
    broadcastChromeGroups();
  }
});

chrome.tabGroups.onRemoved.addListener(g => {
  for (const [title, data] of chromeGroups) {
    if (data.chromeGroupId === g.id) { chromeGroups.delete(title); break; }
  }
  broadcastChromeGroups();
});

chrome.tabGroups.onUpdated.addListener(g => {
  for (const [title, data] of chromeGroups) {
    if (data.chromeGroupId === g.id && title !== g.title) { chromeGroups.delete(title); break; }
  }
  if (isClaudeGroup(g.title)) {
    chromeGroups.set(g.title, { chromeGroupId: g.id, color: g.color });
  }
  broadcastChromeGroups();
});

initChromeGroups();

function getAliveSessions() {
  const now = Date.now();
  return [...sessionLastAlive.entries()]
    .filter(([, ts]) => now - ts < SESSION_TTL_MS)
    .map(([sid]) => sid);
}

function buildStatePayload() {
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

function broadcastEvent(event) {
  const payload = {
    type: "event",
    event,
    activeTabs: Object.fromEntries(activeTabs),
    groups: Object.fromEntries(groups),
    descriptions: Object.fromEntries(descriptions),
    chromeGroups: Object.fromEntries(chromeGroups),
    aliveSessions: getAliveSessions(),
  };
  popupPorts = popupPorts.filter(port => {
    try {
      port.postMessage(payload);
      return true;
    } catch {
      return false;
    }
  });
}

function enforceScreenshotLimit() {
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

self.__mcpLogEvent = function (eventJson) {
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
    });
    persistActiveTabs();
  } else if (event.type === "tab_done" || event.type === "tab_close") {
    activeTabs.delete(event.tabId);
    persistActiveTabs();
  }

  if (event.sessionId) {
    sessionLastAlive.set(event.sessionId, Date.now());
    persistSessionAlive();
  }

  if (event.type === "session_alive") {
    broadcastEvent(event);
    return;
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

chrome.runtime.onConnect.addListener(port => {
  if (port.name === "keepAlive") {
    port.onDisconnect.addListener(() => {});
    return;
  }

  if (port.name === "popup") {
    popupPorts.push(port);
    try {
      port.postMessage(buildStatePayload());
    } catch {}

    port.onDisconnect.addListener(() => {
      popupPorts = popupPorts.filter(p => p !== port);
    });
    return;
  }
});

function drawRobotFrame(squinting, size) {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const s = size / 32;

  ctx.fillStyle = "white";
  ctx.fillRect(2*s, 1*s, 28*s, 20*s);
  ctx.fillRect(2*s, 20*s, 10*s, 11*s);
  ctx.fillRect(20*s, 20*s, 10*s, 11*s);
  ctx.fillStyle = "#C87850";
  ctx.fillRect(4*s, 3*s, 24*s, 17*s);
  ctx.fillRect(4*s, 20*s, 8*s, 9*s);
  ctx.fillRect(20*s, 20*s, 8*s, 9*s);
  ctx.fillStyle = "#1a1a1a";

  if (!squinting) {
    ctx.fillRect(8*s, 9*s, 4*s, 4*s);
    ctx.fillRect(20*s, 9*s, 4*s, 4*s);
  } else {
    ctx.lineWidth = 2.5 * s;
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(7*s, 8*s); ctx.lineTo(13*s, 11*s); ctx.lineTo(7*s, 14*s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(25*s, 8*s); ctx.lineTo(19*s, 11*s); ctx.lineTo(25*s, 14*s);
    ctx.stroke();
  }

  return ctx.getImageData(0, 0, size, size);
}

async function setRobotIcon(squinting) {
  try {
    const imageData = drawRobotFrame(squinting, 32);
    await chrome.action.setIcon({ imageData: { 32: imageData } });
  } catch {}
}

let iconAnimInterval = null;
let iconFrame = 0;

function startIconAnimation() {
  if (iconAnimInterval) return;
  iconFrame = 0;
  iconAnimInterval = setInterval(() => {
    setRobotIcon(iconFrame % 2 === 1);
    iconFrame++;
  }, 250);
}

function stopIconAnimation() {
  if (iconAnimInterval) {
    clearInterval(iconAnimInterval);
    iconAnimInterval = null;
  }
  setRobotIcon(false);
}

async function injectIntoExistingTabs() {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (!tab.id || tab.url?.startsWith("chrome://") || tab.url?.startsWith("chrome-extension://")) continue;
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    } catch {}
  }
}

chrome.runtime.onInstalled.addListener(() => {
  setRobotIcon(false);
  injectIntoExistingTabs();
});

chrome.runtime.onStartup.addListener(() => {
  setRobotIcon(false);
  injectIntoExistingTabs();
});

setRobotIcon(false);
