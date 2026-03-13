let state = { events: [], activeTabs: {}, groups: {} };
let sessionFilter = "all";
let currentView = "log";

const port = chrome.runtime.connect({ name: "popup" });

port.onMessage.addListener(msg => {
  if (msg.type === "state") {
    state.events = msg.events || [];
    state.activeTabs = msg.activeTabs || {};
    state.groups = msg.groups || {};
    renderAll();
  } else if (msg.type === "event") {
    state.events = [msg.event, ...state.events].slice(0, 500);
    state.activeTabs = msg.activeTabs || {};
    state.groups = msg.groups || {};
    updateSessionFilter();
    renderActiveTabs();
    if (currentView === "log") renderEvents();
    else renderScreenshots();
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

  list.innerHTML = entries.map(([tabId, info]) => `
    <div class="active-tab-item">
      <div class="pulse-dot"></div>
      <div class="active-tab-info">
        <span class="active-tab-url">${safeHostname(info.url) || info.title || tabId}</span>
        <div class="active-tab-meta">
          <span class="active-tab-session">${(info.sessionId || "").slice(0, 8)}</span>
          <span class="active-tab-group">${info.groupName || ""}</span>
        </div>
      </div>
    </div>
  `).join("");
}

function renderEvents() {
  const list = document.getElementById("event-list");
  const filtered = sessionFilter === "all"
    ? state.events
    : state.events.filter(e => e.sessionId === sessionFilter);

  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-log">No events</div>';
    return;
  }

  list.innerHTML = filtered.map(event => `
    <div class="event-item">
      ${eventBadge(event.type)}
      <div class="event-body">
        <div class="event-tool">${event.tool || event.type}</div>
        ${event.tabUrl ? `<div class="event-url">${safeHostname(event.tabUrl)}</div>` : ""}
      </div>
      <div class="event-meta">
        <span class="event-session">${event.sessionId || ""}</span>
        <span class="event-time">${formatTime(event.timestamp)}</span>
      </div>
    </div>
  `).join("");
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

function updateSessionFilter() {
  const select = document.getElementById("session-select");
  const currentValue = select.value;
  const sessions = [...new Set(state.events.map(e => e.sessionId).filter(Boolean))];

  const sessionToGroup = Object.fromEntries(
    Object.entries(state.groups).map(([group, sid]) => [sid, group])
  );
  select.innerHTML = '<option value="all">All sessions</option>' +
    sessions.map(s => {
      const group = sessionToGroup[s] || "";
      const label = group ? `${s} · ${group}` : s;
      return `<option value="${s}"${s === currentValue ? " selected" : ""}>${label}</option>`;
    }).join("");

  sessionFilter = select.value;

  const badge = document.getElementById("session-badge");
  if (sessions.length > 0) {
    badge.textContent = sessions[0];
    badge.style.display = "";
  } else {
    badge.textContent = "";
    badge.style.display = "none";
  }
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

document.getElementById("session-select").addEventListener("change", e => {
  sessionFilter = e.target.value;
  renderEvents();
  renderScreenshots();
});

document.getElementById("clear-btn").addEventListener("click", () => {
  state.events = [];
  renderAll();
});

document.getElementById("modal").addEventListener("click", closeModal);

drawLogo();
