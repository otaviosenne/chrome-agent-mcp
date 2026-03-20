import { describe, it, expect, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { getCurrentSessionTitle } from "../../src/tools/session.js";

const TEST_DIR = join(tmpdir(), "session-tests");

function setupTempDir(): void {
  mkdirSync(TEST_DIR, { recursive: true });
}

function cleanupTempDir(): void {
  rmSync(TEST_DIR, { recursive: true, force: true });
}

function writeTempSessionFile(filename: string, lines: object[]): string {
  setupTempDir();
  const filePath = join(TEST_DIR, filename);
  const content = lines.map((l) => JSON.stringify(l)).join("\n");
  writeFileSync(filePath, content, "utf8");
  return filePath;
}

afterEach(() => {
  cleanupTempDir();
});

describe("getCurrentSessionTitle", () => {
  it("reads title from provided file path", () => {
    const filePath = writeTempSessionFile("test-session.jsonl", [
      { type: "message", role: "user", content: "hello" },
      { customTitle: "My Custom Session" },
    ]);

    const title = getCurrentSessionTitle(filePath);

    expect(title).toBe("My Custom Session");
  });

  it("reads agentName when customTitle is absent", () => {
    const filePath = writeTempSessionFile("agent-session.jsonl", [
      { agentName: "fix chrome mcp" },
    ]);

    const title = getCurrentSessionTitle(filePath);

    expect(title).toBe("fix chrome mcp");
  });

  it("prefers last customTitle over earlier agentName", () => {
    const filePath = writeTempSessionFile("multi-session.jsonl", [
      { agentName: "old name" },
      { customTitle: "new title" },
    ]);

    const title = getCurrentSessionTitle(filePath);

    expect(title).toBe("new title");
  });

  it("returns null for a path that does not exist", () => {
    const nonExistentPath = join(TEST_DIR, "ghost-session.jsonl");

    const title = getCurrentSessionTitle(nonExistentPath);

    expect(title).toBeNull();
  });

  it("returns null when file has no title entries", () => {
    const filePath = writeTempSessionFile("empty-session.jsonl", [
      { type: "message", role: "user", content: "hello" },
    ]);

    const title = getCurrentSessionTitle(filePath);

    expect(title).toBeNull();
  });

  it("handles malformed json lines without throwing", () => {
    setupTempDir();
    const filePath = join(TEST_DIR, "malformed.jsonl");
    writeFileSync(filePath, 'not-json\n{"customTitle":"valid title"}\nmore-garbage', "utf8");

    const title = getCurrentSessionTitle(filePath);

    expect(title).toBe("valid title");
  });
});
