import {
  popupPorts,
  setPopupPorts,
  chromeGroups,
  groups,
  activeTabs,
  descriptions,
  getAliveSessions,
  restorePromise,
  buildStatePayloadFull,
  initState,
  SESSION_TTL_MS,
} from "./commands.js";

const ANIMAL_NAMES = ["Pinguim","Fenix","Girafa","Papagaio","Pantera","Polvo","Peixe","Capivara"];

function isClaudeGroup(title) {
  if (!title) return false;
  return ANIMAL_NAMES.some(a => title === a || title.startsWith(a + " "));
}

export function broadcastToPopups(payload) {
  const alive = popupPorts.filter(port => {
    try { port.postMessage(payload); return true; } catch { return false; }
  });
  setPopupPorts(alive);
}

export function broadcastEvent(event) {
  broadcastToPopups({
    type: "event",
    event,
    activeTabs: Object.fromEntries(activeTabs),
    groups: Object.fromEntries(groups),
    descriptions: Object.fromEntries(descriptions),
    chromeGroups: Object.fromEntries(chromeGroups),
    aliveSessions: getAliveSessions(),
  });
}

function broadcastChromeGroups() {
  const payload = { type: "chrome_groups", chromeGroups: Object.fromEntries(chromeGroups) };
  const alive = popupPorts.filter(port => {
    try { port.postMessage(payload); return true; } catch { return false; }
  });
  setPopupPorts(alive);
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

export function registerEventListeners() {
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

  chrome.runtime.onConnect.addListener(port => {
    if (port.name === "keepAlive") {
      port.onMessage.addListener(() => {});
      port.onDisconnect.addListener(() => {});
      return;
    }

    if (port.name === "popup") {
      popupPorts.push(port);
      port.onDisconnect.addListener(() => {
        setPopupPorts(popupPorts.filter(p => p !== port));
      });
      restorePromise.then(async () => {
        try { port.postMessage(await buildStatePayloadFull()); } catch {}
      });
      return;
    }
  });

  chrome.runtime.onInstalled.addListener(() => {
    initState();
  });

  chrome.runtime.onStartup.addListener(() => {
    initState();
  });

  initChromeGroups();
}
