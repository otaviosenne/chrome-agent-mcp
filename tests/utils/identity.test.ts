import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isAnimalName, claudeToChrome, chromeToClaude, VALID_CLAUDE_COLORS, nextAnimal } from "../../src/utils/identity.js";

vi.mock("fs", () => ({
  readFileSync: vi.fn(() => { throw new Error("no file"); }),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

describe("isAnimalName", () => {
  it("returns true for exact animal name", () => {
    expect(isAnimalName("Pinguim")).toBe(true);
  });

  it("returns true for animal name with suffix", () => {
    expect(isAnimalName("Pinguim 1")).toBe(true);
  });

  it("returns true for all animals in the list", () => {
    const names = ["Pinguim", "Fenix", "Girafa", "Papagaio", "Pantera", "Polvo", "Peixe", "Capivara"];
    for (const name of names) {
      expect(isAnimalName(name)).toBe(true);
    }
  });

  it("returns false for unknown name", () => {
    expect(isAnimalName("Cachorro")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isAnimalName("")).toBe(false);
  });

  it("returns false for partial match that is not a prefix", () => {
    expect(isAnimalName("Pingu")).toBe(false);
  });
});

describe("claudeToChrome", () => {
  it("maps red to red", () => {
    expect(claudeToChrome("red")).toBe("red");
  });

  it("maps blue to blue", () => {
    expect(claudeToChrome("blue")).toBe("blue");
  });

  it("maps default to grey", () => {
    expect(claudeToChrome("default")).toBe("grey");
  });

  it("is case-insensitive", () => {
    expect(claudeToChrome("RED")).toBe("red");
  });

  it("returns null for unknown color", () => {
    expect(claudeToChrome("magenta")).toBeNull();
  });
});

describe("chromeToClaude", () => {
  it("maps red to red", () => {
    expect(chromeToClaude("red")).toBe("red");
  });

  it("maps grey to default", () => {
    expect(chromeToClaude("grey")).toBe("default");
  });

  it("is case-insensitive", () => {
    expect(chromeToClaude("BLUE")).toBe("blue");
  });

  it("returns null for unknown color", () => {
    expect(chromeToClaude("magenta")).toBeNull();
  });
});

describe("VALID_CLAUDE_COLORS", () => {
  it("includes red", () => {
    expect(VALID_CLAUDE_COLORS).toContain("red");
  });

  it("includes blue", () => {
    expect(VALID_CLAUDE_COLORS).toContain("blue");
  });

  it("includes default", () => {
    expect(VALID_CLAUDE_COLORS).toContain("default");
  });

  it("has at least 9 colors", () => {
    expect(VALID_CLAUDE_COLORS.length).toBeGreaterThanOrEqual(9);
  });
});

describe("claudeToChrome - all shared colors round-trip", () => {
  const shared = ["red", "blue", "green", "yellow", "purple", "orange", "pink", "cyan"];
  for (const color of shared) {
    it(`claudeToChrome("${color}") === "${color}"`, () => {
      expect(claudeToChrome(color)).toBe(color);
    });
  }
});

describe("chromeToClaude - all shared colors round-trip", () => {
  const shared = ["red", "blue", "green", "yellow", "purple", "orange", "pink", "cyan"];
  for (const color of shared) {
    it(`chromeToClaude("${color}") === "${color}"`, () => {
      expect(chromeToClaude(color)).toBe(color);
    });
  }
});

describe("nextAnimal", () => {
  it("returns an object with name and chromeColor", () => {
    const animal = nextAnimal();
    expect(animal).toHaveProperty("name");
    expect(animal).toHaveProperty("chromeColor");
  });

  it("returns a non-empty name", () => {
    const animal = nextAnimal();
    expect(typeof animal.name).toBe("string");
    expect(animal.name.length).toBeGreaterThan(0);
  });

  it("returns a valid chrome color", () => {
    const validColors = ["blue", "red", "yellow", "green", "pink", "purple", "cyan", "orange"];
    const animal = nextAnimal();
    expect(validColors).toContain(animal.chromeColor);
  });
});
