import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../extension/popup/app.js", () => ({
  state: {
    events: [],
    activeTabs: {},
    groups: {},
    descriptions: {},
    chromeGroups: {},
    aliveSessions: [],
    chromeTabs: {},
  },
  expandedGroups: new Set(),
  expandedHeartbeatGroups: new Set(),
}));

const { safeHostname, formatTime, buildEventSegments } = await import("../../extension/popup/tabs.js");

describe("safeHostname", () => {
  it("extracts hostname from full URL", () => {
    expect(safeHostname("https://www.example.com/path?q=1")).toBe("example.com");
  });

  it("strips www prefix", () => {
    expect(safeHostname("https://www.google.com")).toBe("google.com");
  });

  it("returns hostname without www for subdomain URLs", () => {
    expect(safeHostname("https://api.github.com/repos")).toBe("api.github.com");
  });

  it("returns empty string for empty input", () => {
    expect(safeHostname("")).toBe("");
  });

  it("returns the original string for invalid URLs", () => {
    expect(safeHostname("not-a-url")).toBe("not-a-url");
  });

  it("handles null/undefined gracefully", () => {
    expect(safeHostname(null as unknown as string)).toBe("");
  });
});

describe("formatTime", () => {
  it("returns empty string for falsy input", () => {
    expect(formatTime(0)).toBe("");
    expect(formatTime(null as unknown as number)).toBe("");
    expect(formatTime(undefined as unknown as number)).toBe("");
  });

  it("returns a time string for a valid timestamp", () => {
    const ts = new Date("2024-01-15T14:30:45Z").getTime();
    const result = formatTime(ts);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("includes hour and minute in output", () => {
    const ts = Date.now();
    const result = formatTime(ts);
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });
});

describe("buildEventSegments", () => {
  it("returns regular events as-is", () => {
    const events = [
      { type: "tab_open", sessionId: "s1", timestamp: 1 },
      { type: "tab_close", sessionId: "s1", timestamp: 2 },
    ];

    const segments = buildEventSegments(events);

    expect(segments).toHaveLength(2);
    expect(segments[0]).toBe(events[0]);
    expect(segments[1]).toBe(events[1]);
  });

  it("groups consecutive session_alive events into a heartbeat group", () => {
    const events = [
      { type: "session_alive", sessionId: "s1", timestamp: 100 },
      { type: "session_alive", sessionId: "s2", timestamp: 200 },
      { type: "session_alive", sessionId: "s1", timestamp: 300 },
    ];

    const segments = buildEventSegments(events);

    expect(segments).toHaveLength(1);
    expect((segments[0] as any).isHeartbeatGroup).toBe(true);
    expect((segments[0] as any).events).toHaveLength(3);
  });

  it("separates heartbeat groups by intervening events", () => {
    const events = [
      { type: "session_alive", sessionId: "s1", timestamp: 100 },
      { type: "tab_open", sessionId: "s1", timestamp: 200 },
      { type: "session_alive", sessionId: "s1", timestamp: 300 },
    ];

    const segments = buildEventSegments(events);

    expect(segments).toHaveLength(3);
    expect((segments[0] as any).isHeartbeatGroup).toBe(true);
    expect((segments[1] as any).type).toBe("tab_open");
    expect((segments[2] as any).isHeartbeatGroup).toBe(true);
  });

  it("returns empty array for empty input", () => {
    expect(buildEventSegments([])).toEqual([]);
  });

  it("assigns unique id to each heartbeat group", () => {
    const events1 = [{ type: "session_alive", sessionId: "s1", timestamp: 1 }];
    const events2 = [{ type: "session_alive", sessionId: "s2", timestamp: 2 }];

    const [seg1] = buildEventSegments(events1) as any[];
    const [seg2] = buildEventSegments(events2) as any[];

    expect(seg1.id).not.toBe(seg2.id);
  });
});
