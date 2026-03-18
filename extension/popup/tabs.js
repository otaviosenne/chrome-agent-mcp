import { state, expandedGroups, expandedHeartbeatGroups } from "./app.js";

const CHROME_COLOR_CSS = {
  grey:   "#6b7280",
  blue:   "#3b82f6",
  red:    "#ef4444",
  yellow: "#ca8a04",
  green:  "#16a34a",
  pink:   "#ec4899",
  purple: "#9333ea",
  cyan:   "#0891b2",
  orange: "#ea580c",
};

function chromeColorToCss(color) {
  return CHROME_COLOR_CSS[color] || CHROME_COLOR_CSS.grey;
}

export function safeHostname(url) {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url || "";
  }
}

export function formatTime(timestamp) {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function aliveGroupNames() {
  const aliveSet = new Set(state.aliveSessions);
  if (aliveSet.size === 0) return new Set();

  const names = new Set();

  for (const groupTitle of Object.keys(state.chromeGroups)) {
    const sessionId = state.groups[groupTitle];
    if (sessionId && aliveSet.has(sessionId)) {
      names.add(groupTitle);
    }
  }

  for (const [groupTitle, sessionId] of Object.entries(state.groups)) {
    if (aliveSet.has(sessionId)) names.add(groupTitle);
  }

  return names;
}

export function renderActiveTabs() {
  const list = document.getElementById("active-tabs-list");
  const groupNames = aliveGroupNames();

  if (groupNames.size === 0) {
    list.innerHTML = '<div class="empty-active">No active tabs</div>';
    return;
  }

  const now = Date.now();
  const ACTIVE_TTL = 30000;

  const byGroup = new Map();
  for (const [, info] of Object.entries(state.activeTabs)) {
    const key = info.groupName;
    if (!key) continue;
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key).push(info);
  }

  list.innerHTML = Array.from(groupNames).map(groupName => {
    const isExpanded = expandedGroups.has(groupName);
    const bridgeTabs = byGroup.get(groupName) || [];
    const chromeFallback = (state.chromeTabs[groupName] || []).map(t => ({ url: t.url, title: t.title, lastActivity: 0 }));
    const tabs = bridgeTabs.length > 0 ? bridgeTabs : chromeFallback;
    const hasActive = bridgeTabs.some(info => now - (info.lastActivity || 0) < ACTIVE_TTL);

    const tabsHtml = tabs.length > 0
      ? tabs.map(info => {
          const isActive = bridgeTabs.length > 0 && now - (info.lastActivity || 0) < ACTIVE_TTL;
          const url = safeHostname(info.url) || info.url || "–";
          return `
            <div class="group-tab-row">
              <span class="tab-activity-dot ${isActive ? "dot-tab-active" : "dot-tab-idle"}"></span>
              <span class="tab-url">${url}</span>
            </div>
          `;
        }).join("")
      : '<div class="group-tab-row"><span class="tab-url" style="opacity:0.5">No open tabs</span></div>';

    return `
      <div class="group-item">
        <div class="group-header" data-group="${groupName}">
          <span class="pulse-dot${hasActive ? "" : " pulse-dot-idle"}"></span>
          <span class="group-name">${groupName}</span>
          <svg class="chevron${isExpanded ? " chevron-up" : ""}" width="10" height="6" viewBox="0 0 10 6">
            <path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          </svg>
        </div>
        ${isExpanded ? `<div class="group-tabs">${tabsHtml}</div>` : ""}
      </div>
    `;
  }).join("");

  list.querySelectorAll(".group-header").forEach(header => {
    header.addEventListener("click", () => {
      const g = header.dataset.group;
      if (expandedGroups.has(g)) expandedGroups.delete(g);
      else expandedGroups.add(g);
      renderActiveTabs();
    });
  });
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

function renderEventItem(event) {
  const sessionLabel = event.groupName || (event.sessionId || "").slice(0, 8);
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
}

function renderHeartbeatGroup(group) {
  const isExpanded = expandedHeartbeatGroups.has(group.id);
  const count = group.events.length;
  const sessionIds = [...new Set(group.events.map(e => (e.sessionId || "").slice(0, 8)))];
  const latestTime = formatTime(group.events[0]?.timestamp);
  const sessionTags = sessionIds.map(s => `<span class="hb-session-tag">${s}</span>`).join("");
  const detail = isExpanded ? `
    <div class="hb-detail">
      ${group.events.map(e => `
        <div class="hb-detail-row">
          <span class="hb-detail-session">${(e.sessionId || "").slice(0, 8)}</span>
          <span class="hb-detail-group">${e.groupName || ""}</span>
          <span class="hb-detail-time">${formatTime(e.timestamp)}</span>
        </div>
      `).join("")}
    </div>
  ` : "";
  return `
    <div class="hb-group-item">
      <div class="hb-group-header" data-hb-id="${group.id}">
        <span class="event-type-badge badge-hb">HB</span>
        <div class="hb-group-body">
          <span class="hb-group-count">${count} heartbeat${count > 1 ? "s" : ""}</span>
          <span class="hb-sessions">${sessionTags}</span>
        </div>
        <div class="event-meta">
          <span class="event-time">${latestTime}</span>
        </div>
        <svg class="chevron${isExpanded ? " chevron-up" : ""}" width="10" height="6" viewBox="0 0 10 6">
          <path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        </svg>
      </div>
      ${detail}
    </div>
  `;
}

function buildEventSegments(filteredEvents) {
  const segments = [];
  let i = 0;
  while (i < filteredEvents.length) {
    if (filteredEvents[i].type === "session_alive") {
      const group = { isHeartbeatGroup: true, events: [], id: `hb-${filteredEvents[i].id || filteredEvents[i].timestamp}` };
      while (i < filteredEvents.length && filteredEvents[i].type === "session_alive") {
        group.events.push(filteredEvents[i]);
        i++;
      }
      segments.push(group);
    } else {
      segments.push(filteredEvents[i]);
      i++;
    }
  }
  return segments;
}

export function renderEvents(sessionFilter) {
  const list = document.getElementById("event-list");
  const filtered = sessionFilter !== "all"
    ? state.events.filter(e => e.sessionId === sessionFilter)
    : state.events;

  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-log">No events</div>';
    return;
  }

  const segments = buildEventSegments(filtered);
  list.innerHTML = segments.map(seg =>
    seg.isHeartbeatGroup ? renderHeartbeatGroup(seg) : renderEventItem(seg)
  ).join("");

  list.querySelectorAll(".hb-group-header").forEach(header => {
    header.addEventListener("click", () => {
      const id = header.dataset.hbId;
      if (expandedHeartbeatGroups.has(id)) expandedHeartbeatGroups.delete(id);
      else expandedHeartbeatGroups.add(id);
      renderEvents(sessionFilter);
    });
  });
}

export function renderScreenshots(sessionFilter) {
  const grid = document.getElementById("screenshot-grid");
  const allFiltered = sessionFilter !== "all"
    ? state.events.filter(e => e.sessionId === sessionFilter)
    : state.events;
  const filtered = allFiltered.filter(e => e.type === "screenshot" && e.screenshot);

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="empty-screenshots">No screenshots</div>';
    return;
  }

  grid.innerHTML = filtered.map(event => {
    const dotColor = chromeColorToCss(event.groupColor);
    return `
    <div class="screenshot-wrapper">
      <div class="screenshot-thumb" data-src="data:image/png;base64,${event.screenshot}">
        <div class="screenshot-group-dot" style="background:${dotColor}"></div>
        <img src="data:image/png;base64,${event.screenshot}" alt="Screenshot" loading="lazy" />
      </div>
      <button class="screenshot-copy-btn" data-src="data:image/png;base64,${event.screenshot}">Copy</button>
    </div>
  `;
  }).join("");

  grid.querySelectorAll(".screenshot-thumb").forEach(thumb => {
    thumb.addEventListener("click", () => openModal(thumb.dataset.src));
  });

  grid.querySelectorAll(".screenshot-copy-btn").forEach(btn => {
    btn.addEventListener("click", async e => {
      e.stopPropagation();
      try {
        const res = await fetch(btn.dataset.src);
        const blob = await res.blob();
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        btn.textContent = "Copied";
        setTimeout(() => { btn.textContent = "Copy"; }, 1500);
      } catch {
        btn.textContent = "Failed";
        setTimeout(() => { btn.textContent = "Copy"; }, 1500);
      }
    });
  });
}

function openModal(src) {
  const modal = document.getElementById("modal");
  const img = document.getElementById("modal-img");
  img.src = src;
  modal.hidden = false;
}
