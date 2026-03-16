import { renderActiveTabs, renderEvents, renderScreenshots, safeHostname, formatTime } from "./tabs.js";

export const state = {
  events: [],
  activeTabs: {},
  groups: {},
  descriptions: {},
  chromeGroups: {},
  aliveSessions: [],
  chromeTabs: {},
};

export const expandedGroups = new Set();
export const expandedHeartbeatGroups = new Set();

let sessionFilter = "all";
let currentView = "log";

function drawLogo() {
  const canvas = document.getElementById("logo-canvas");
  const ctx = canvas.getContext("2d");
  const s = canvas.width / 32;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "white";
  ctx.fillRect(2*s, 1*s, 28*s, 20*s);
  ctx.fillRect(2*s, 20*s, 10*s, 11*s);
  ctx.fillRect(20*s, 20*s, 10*s, 11*s);
  ctx.fillStyle = "#C87850";
  ctx.fillRect(4*s, 3*s, 24*s, 17*s);
  ctx.fillRect(4*s, 20*s, 8*s, 9*s);
  ctx.fillRect(20*s, 20*s, 8*s, 9*s);
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(8*s, 9*s, 4*s, 4*s);
  ctx.fillRect(20*s, 9*s, 4*s, 4*s);
}

function buildDropdownItems() {
  const items = [{ value: "all", label: "All sessions", orphan: false }];
  const sortedGroups = Object.keys(state.chromeGroups).sort((a, b) => a.localeCompare(b));

  for (const groupTitle of sortedGroups) {
    const sessionId = state.groups[groupTitle] || "";
    const isOrphan = state.aliveSessions.length > 0 && (!sessionId || !state.aliveSessions.includes(sessionId));
    const desc = state.descriptions[groupTitle] || "";
    const label = desc ? `${groupTitle} — ${desc}` : groupTitle;
    items.push({ value: sessionId, label, orphan: isOrphan, groupTitle });
  }

  return items;
}

function openDropdown() {
  document.getElementById("session-menu").hidden = false;
  document.getElementById("session-trigger").classList.add("open");
}

function closeDropdown() {
  document.getElementById("session-menu").hidden = true;
  document.getElementById("session-trigger").classList.remove("open");
}

export function updateSessionFilter() {
  const triggerText = document.getElementById("session-trigger-text");
  const menu = document.getElementById("session-menu");
  const items = buildDropdownItems();

  menu.innerHTML = items.map(item => `
    <div class="dropdown-item ${item.value === sessionFilter ? "selected" : ""} ${item.orphan && item.value !== "all" ? "orphan" : ""}"
         data-value="${item.value}"
         ${item.orphan && item.value !== "all" ? `data-tooltip="Nenhum Claude Code associado a este grupo"` : ""}>
      <span class="status-dot ${item.orphan && item.value !== "all" ? "dot-orphan" : item.value !== "all" ? "dot-active" : "dot-none"}"></span>
      <span class="item-label">${item.label}</span>
    </div>
  `).join("");

  menu.querySelectorAll(".dropdown-item").forEach(el => {
    el.addEventListener("click", () => {
      sessionFilter = el.dataset.value;
      closeDropdown();
      updateSessionFilter();
      renderEvents(sessionFilter);
      renderScreenshots(sessionFilter);
    });
  });

  const current = items.find(i => i.value === sessionFilter) || items[0];
  triggerText.textContent = current.label;

  const badge = document.getElementById("session-badge");
  const firstSession = Object.values(state.groups)[0];
  if (firstSession) {
    badge.textContent = firstSession.slice(0, 8);
    badge.style.display = "";
  } else {
    badge.textContent = "";
    badge.style.display = "none";
  }
}

function renderAll() {
  updateSessionFilter();
  renderActiveTabs();
  renderEvents(sessionFilter);
  renderScreenshots(sessionFilter);
}

function closeModal() {
  const modal = document.getElementById("modal");
  modal.hidden = true;
  document.getElementById("modal-img").src = "";
}

function setupMessageListener() {
  const port = chrome.runtime.connect({ name: "popup" });

  port.onMessage.addListener(msg => {
    if (msg.type === "state") {
      state.events = msg.events?.length ? msg.events : state.events;
      state.activeTabs = msg.activeTabs || {};
      state.groups = msg.groups || {};
      state.descriptions = msg.descriptions || {};
      state.chromeGroups = msg.chromeGroups || {};
      state.aliveSessions = msg.aliveSessions || [];
      state.chromeTabs = msg.chromeTabs || {};
      renderAll();
    } else if (msg.type === "event" || msg.type === "session_alive") {
      if (msg.type === "event") {
        state.events = [msg.event, ...state.events].slice(0, 500);
      }
      state.activeTabs = msg.activeTabs || state.activeTabs;
      state.groups = msg.groups || state.groups;
      state.descriptions = msg.descriptions || state.descriptions;
      state.chromeGroups = msg.chromeGroups || state.chromeGroups;
      state.aliveSessions = msg.aliveSessions || state.aliveSessions;
      updateSessionFilter();
      renderActiveTabs();
      if (msg.type === "event") {
        if (currentView === "log") renderEvents(sessionFilter);
        else renderScreenshots(sessionFilter);
      }
    } else if (msg.type === "chrome_groups") {
      state.chromeGroups = msg.chromeGroups || {};
      updateSessionFilter();
      renderActiveTabs();
    }
  });
}

function setupTabNavigation() {
  document.getElementById("log-tab").addEventListener("click", () => {
    currentView = "log";
    document.getElementById("log-tab").classList.add("active");
    document.getElementById("screenshots-tab").classList.remove("active");
    document.getElementById("log-view").hidden = false;
    document.getElementById("screenshots-view").hidden = true;
  });

  document.getElementById("screenshots-tab").addEventListener("click", () => {
    currentView = "screenshots";
    document.getElementById("screenshots-tab").classList.add("active");
    document.getElementById("log-tab").classList.remove("active");
    document.getElementById("log-view").hidden = true;
    document.getElementById("screenshots-view").hidden = false;
    renderScreenshots(sessionFilter);
  });
}

function setupFilterBar() {
  document.getElementById("session-trigger").addEventListener("click", e => {
    e.stopPropagation();
    const menu = document.getElementById("session-menu");
    if (menu.hidden) openDropdown(); else closeDropdown();
  });

  document.addEventListener("click", () => closeDropdown());

  document.getElementById("copy-btn").addEventListener("click", async () => {
    const btn = document.getElementById("copy-btn");
    const filtered = sessionFilter !== "all"
      ? state.events.filter(e => e.sessionId === sessionFilter)
      : state.events;
    const text = filtered.map(e => {
      const desc = e.groupName && state.descriptions[e.groupName];
      const label = desc || (e.sessionId || "").slice(0, 8);
      const url = e.tabUrl ? ` — ${safeHostname(e.tabUrl)}` : "";
      return `[${formatTime(e.timestamp)}] ${e.type} ${e.tool || ""}${url} (${label})`;
    }).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = "Copied";
      setTimeout(() => { btn.textContent = "Copy"; }, 1500);
    } catch {
      btn.textContent = "Failed";
      setTimeout(() => { btn.textContent = "Copy"; }, 1500);
    }
  });

  document.getElementById("clear-btn").addEventListener("click", () => {
    state.events = [];
    renderAll();
  });
}

function init() {
  chrome.storage.local.get(["events", "activeTabs", "groups", "descriptions"], stored => {
    if (stored.events?.length) state.events = stored.events;
    if (stored.activeTabs) state.activeTabs = stored.activeTabs;
    if (stored.groups) state.groups = stored.groups;
    if (stored.descriptions) state.descriptions = stored.descriptions;
    renderAll();
  });

  setupMessageListener();
  setupTabNavigation();
  setupFilterBar();

  document.getElementById("modal").addEventListener("click", closeModal);

  drawLogo();
}

init();
