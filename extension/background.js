const MAX_EVENTS = 500;
const MAX_SCREENSHOTS = 20;

let events = [];
let activeTabs = new Map();
let groups = new Map();
let popupPorts = [];

function buildStatePayload() {
  return {
    type: "state",
    events,
    activeTabs: Object.fromEntries(activeTabs),
    groups: Object.fromEntries(groups),
  };
}

function broadcastEvent(event) {
  const payload = {
    type: "event",
    event,
    activeTabs: Object.fromEntries(activeTabs),
    groups: Object.fromEntries(groups),
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
    });
  } else if (event.type === "tab_done" || event.type === "tab_close") {
    activeTabs.delete(event.tabId);
  }

  if (event.groupName && event.sessionId) {
    groups.set(event.groupName, event.sessionId);
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
