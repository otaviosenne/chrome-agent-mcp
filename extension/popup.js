let state = { events: [], activeTabs: {}, groups: {}, descriptions: {}, chromeGroups: {}, aliveSessions: [] };
let sessionFilter = "all";
let currentView = "log";

const port = chrome.runtime.connect({ name: "popup" });

port.onMessage.addListener(msg => {
  if (msg.type === "state") {
    state.events = msg.events || [];
    state.activeTabs = msg.activeTabs || {};
    state.groups = msg.groups || {};
    state.descriptions = msg.descriptions || {};
    state.chromeGroups = msg.chromeGroups || {};
    state.aliveSessions = msg.aliveSessions || [];
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
      if (currentView === "log") renderEvents();
      else renderScreenshots();
    }
  } else if (msg.type === "chrome_groups") {
    state.chromeGroups = msg.chromeGroups || {};
    updateSessionFilter();
  }
});

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

function safeHostname(url) {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url || "";
  }
}

function eventBadge(type) {
  switch (type) {
    case "tab_open":  return '<span class="event-type-badge badge-open">OPEN</span>';
    case "tab_close": return '<span class="event-type-badge badge-close">CLOSE</span>';
    case "tab_done":  return '<span class="event-type-badge badge-done">DONE</span>';
    case "screenshot":return '<span class="event-type-badge badge-shot">SHOT</span>';
    default:          return '<span class="event-type-badge badge-action">ACT</span>';
  }
}

function formatTime(timestamp) {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function renderActiveTabs() {
  const list = document.getElementById("active-tabs-list");
  const entries = Object.entries(state.activeTabs);

  if (entries.length === 0) {
    list.innerHTML = '<div class="empty-active">No active tabs</div>';
    return;
  }

  const byGroup = new Map();
  for (const [tabId, info] of entries) {
    const key = info.groupName || tabId;
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key).push([tabId, info]);
  }

  list.innerHTML = Array.from(byGroup.entries()).map(([groupKey, tabs]) => {
    const [, latest] = tabs[tabs.length - 1];
    const sessionId = (latest.sessionId || "").slice(0, 8);
    const sessionDesc = (latest.groupName && state.descriptions[latest.groupName]) || "";
    const domain = safeHostname(latest.url) || latest.title || "";
    const tabVerb = latest.tabVerb || "";
    const tabLine = domain && tabVerb ? `${domain} • ${tabVerb}` : domain || tabVerb || "–";
    const groupName = latest.groupName || "";

    return `
      <div class="active-tab-item">
        <div class="pulse-dot"></div>
        <div class="active-tab-info">
          <div class="active-tab-row-session">
            <span class="active-tab-session-id">${sessionId}</span>
            ${sessionDesc ? `<span class="active-tab-sep">•</span><span class="active-tab-session-desc">${sessionDesc}</span>` : ""}
            <span class="active-tab-group">${groupName}</span>
          </div>
          <div class="active-tab-row-tab">${tabLine}</div>
        </div>
      </div>
    `;
  }).join("");
}

function eventsForCurrentFilter() {
  if (sessionFilter !== "all") {
    return state.events.filter(e => e.sessionId === sessionFilter);
  }
  if (state.aliveSessions.length > 0) {
    const alive = state.events.filter(e => state.aliveSessions.includes(e.sessionId));
    return alive.length > 0 ? alive : state.events;
  }
  return state.events;
}

function renderEvents() {
  const list = document.getElementById("event-list");
  const filtered = eventsForCurrentFilter();

  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-log">No events</div>';
    return;
  }

  list.innerHTML = filtered.map(event => {
    const sid = (event.sessionId || "").slice(0, 8);
    const desc = event.groupName && state.descriptions[event.groupName];
    const sessionLabel = desc ? `${sid} • ${desc}` : sid;
    return `
      <div class="event-item">
        ${eventBadge(event.type)}
        <div class="event-body">
          <div class="event-tool">${event.tool || event.type}</div>
          ${event.tabUrl ? `<div class="event-url">${safeHostname(event.tabUrl)}</div>` : ""}
        </div>
        <div class="event-meta">
          <span class="event-session">${sessionLabel}</span>
          <span class="event-time">${formatTime(event.timestamp)}</span>
        </div>
      </div>
    `;
  }).join("");
}

function renderScreenshots() {
  const grid = document.getElementById("screenshot-grid");
  const screenshots = state.events.filter(e => e.type === "screenshot" && e.screenshot);

  const filterFn = sessionFilter === "all"
    ? () => true
    : e => e.sessionId === sessionFilter;

  const filtered = screenshots.filter(filterFn);

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="empty-screenshots">No screenshots</div>';
    return;
  }

  grid.innerHTML = filtered.map(event => `
    <div class="screenshot-thumb" data-src="data:image/png;base64,${event.screenshot}">
      <img src="data:image/png;base64,${event.screenshot}" alt="Screenshot" loading="lazy" />
    </div>
  `).join("");

  grid.querySelectorAll(".screenshot-thumb").forEach(thumb => {
    thumb.addEventListener("click", () => openModal(thumb.dataset.src));
  });
}

function openModal(src) {
  const modal = document.getElementById("modal");
  const img = document.getElementById("modal-img");
  img.src = src;
  modal.hidden = false;
}

function closeModal() {
  const modal = document.getElementById("modal");
  modal.hidden = true;
  document.getElementById("modal-img").src = "";
}

function buildDropdownItems() {
  const activeGroups = new Set(
    Object.values(state.activeTabs).map(t => t.groupName).filter(Boolean)
  );

  const items = [{ value: "all", label: "All sessions", orphan: false }];

  const sortedGroups = Object.keys(state.chromeGroups).sort((a, b) => {
    const na = parseInt(a.replace("CLAUDE #", ""), 10);
    const nb = parseInt(b.replace("CLAUDE #", ""), 10);
    return na - nb;
  });

  for (const groupTitle of sortedGroups) {
    const sessionId = state.groups[groupTitle] || "";
    const isOrphan = !sessionId || !state.aliveSessions.includes(sessionId);
    const desc = state.descriptions[groupTitle] || "";
    const label = desc ? `${groupTitle} — ${desc}` : groupTitle;
    items.push({ value: sessionId, label, orphan: isOrphan, groupTitle });
  }

  return items;
}

function updateSessionFilter() {
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
      renderEvents();
      renderScreenshots();
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

function openDropdown() {
  document.getElementById("session-menu").hidden = false;
  document.getElementById("session-trigger").classList.add("open");
}

function closeDropdown() {
  document.getElementById("session-menu").hidden = true;
  document.getElementById("session-trigger").classList.remove("open");
}

function renderAll() {
  updateSessionFilter();
  renderActiveTabs();
  renderEvents();
  renderScreenshots();
}

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
  renderScreenshots();
});

document.getElementById("session-trigger").addEventListener("click", e => {
  e.stopPropagation();
  const menu = document.getElementById("session-menu");
  if (menu.hidden) openDropdown(); else closeDropdown();
});

document.addEventListener("click", () => closeDropdown());

document.getElementById("clear-btn").addEventListener("click", () => {
  state.events = [];
  renderAll();
});

document.getElementById("modal").addEventListener("click", closeModal);

drawLogo();
