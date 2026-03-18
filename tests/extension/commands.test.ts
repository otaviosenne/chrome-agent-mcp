import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

vi.mock("../../extension/background/events.js", () => ({
  broadcastToPopups: vi.fn(),
  broadcastEvent: vi.fn(),
}));

vi.mock("../../extension/background/icon.js", () => ({
  setRobotIcon: vi.fn(),
  startIconAnimation: vi.fn(),
  stopIconAnimation: vi.fn(),
}));

const storageMock = {
  local: {
    get: vi.fn().mockResolvedValue({}),
    set: vi.fn().mockResolvedValue(undefined),
  },
  session: {
    get: vi.fn().mockResolvedValue({}),
    set: vi.fn().mockResolvedValue(undefined),
  },
};

vi.stubGlobal("chrome", { storage: storageMock, tabs: { query: vi.fn().mockResolvedValue([]) } });
vi.stubGlobal("self", {});

let commands: typeof import("../../extension/background/commands.js");

beforeAll(async () => {
  commands = await import("../../extension/background/commands.js");
});

beforeEach(() => {
  commands.events.length = 0;
  commands.activeTabs.clear();
  commands.sessionLastAlive.clear();
  vi.clearAllMocks();
});

describe("getAliveSessions", () => {
  it("returns sessions alive within TTL", () => {
    commands.sessionLastAlive.set("sess-1", Date.now());
    commands.sessionLastAlive.set("sess-2", Date.now());

    const result = commands.getAliveSessions();

    expect(result).toContain("sess-1");
    expect(result).toContain("sess-2");
  });

  it("excludes sessions beyond SESSION_TTL_MS", () => {
    commands.sessionLastAlive.set("old-sess", Date.now() - commands.SESSION_TTL_MS - 1000);
    commands.sessionLastAlive.set("new-sess", Date.now());

    const result = commands.getAliveSessions();

    expect(result).not.toContain("old-sess");
    expect(result).toContain("new-sess");
  });

  it("returns empty array when no sessions tracked", () => {
    expect(commands.getAliveSessions()).toEqual([]);
  });
});

describe("cleanupDeadSessionTabs", () => {
  it("removes tabs whose session has expired", () => {
    commands.sessionLastAlive.set("dead-sess", Date.now() - commands.SESSION_TTL_MS - 1000);
    commands.activeTabs.set("tab-1", { url: "https://example.com", sessionId: "dead-sess", groupName: "Girafa" });

    commands.cleanupDeadSessionTabs();

    expect(commands.activeTabs.has("tab-1")).toBe(false);
  });

  it("keeps tabs whose session is alive", () => {
    commands.sessionLastAlive.set("live-sess", Date.now());
    commands.activeTabs.set("tab-2", { url: "https://example.com", sessionId: "live-sess", groupName: "Girafa" });

    commands.cleanupDeadSessionTabs();

    expect(commands.activeTabs.has("tab-2")).toBe(true);
  });

  it("removes tab with sessionId not present in sessionLastAlive", () => {
    commands.activeTabs.set("tab-3", { url: "https://example.com", sessionId: "unknown-sess", groupName: "Girafa" });

    commands.cleanupDeadSessionTabs();

    expect(commands.activeTabs.has("tab-3")).toBe(false);
  });
});

describe("enforceScreenshotLimit", () => {
  it("nullifies screenshots beyond MAX_SCREENSHOTS", () => {
    for (let i = 0; i < commands.MAX_SCREENSHOTS + 5; i++) {
      commands.events.push({ type: "screenshot", screenshot: `data-${i}`, id: `e-${i}` } as any);
    }

    commands.enforceScreenshotLimit();

    const nullified = commands.events.filter(e => e.type === "screenshot" && e.screenshot === null);
    expect(nullified.length).toBe(5);
  });

  it("does not nullify when screenshots are within limit", () => {
    for (let i = 0; i < commands.MAX_SCREENSHOTS; i++) {
      commands.events.push({ type: "screenshot", screenshot: `data-${i}`, id: `e-${i}` } as any);
    }

    commands.enforceScreenshotLimit();

    const nullified = commands.events.filter(e => e.screenshot === null);
    expect(nullified.length).toBe(0);
  });

  it("ignores non-screenshot events", () => {
    commands.events.push({ type: "tab_open", id: "e-1" } as any);
    commands.enforceScreenshotLimit();
    expect(commands.events[0].type).toBe("tab_open");
  });
});

describe("buildStatePayload", () => {
  it("includes all required fields", () => {
    const payload = commands.buildStatePayload();

    expect(payload).toHaveProperty("type", "state");
    expect(payload).toHaveProperty("events");
    expect(payload).toHaveProperty("activeTabs");
    expect(payload).toHaveProperty("groups");
    expect(payload).toHaveProperty("descriptions");
    expect(payload).toHaveProperty("chromeGroups");
    expect(payload).toHaveProperty("aliveSessions");
  });

  it("converts Maps to plain objects", () => {
    commands.activeTabs.set("tab-1", { url: "https://example.com" } as any);
    commands.groups.set("Girafa", "sess-abc");

    const payload = commands.buildStatePayload();

    expect(payload.activeTabs).toEqual({ "tab-1": { url: "https://example.com" } });
    expect(payload.groups).toEqual({ "Girafa": "sess-abc" });
  });

  it("includes alive sessions in aliveSessions array", () => {
    commands.sessionLastAlive.set("live", Date.now());

    const payload = commands.buildStatePayload();

    expect(payload.aliveSessions).toContain("live");
  });
});

describe("MAX_EVENTS and MAX_SCREENSHOTS constants", () => {
  it("MAX_EVENTS is 500", () => {
    expect(commands.MAX_EVENTS).toBe(500);
  });

  it("MAX_SCREENSHOTS is 20", () => {
    expect(commands.MAX_SCREENSHOTS).toBe(20);
  });
});
