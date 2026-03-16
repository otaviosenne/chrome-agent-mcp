import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

export interface AnimalEntry {
  name: string;
  chromeColor: string;
}

const ANIMALS: AnimalEntry[] = [
  { name: "Pinguim",  chromeColor: "blue" },
  { name: "Fenix",    chromeColor: "red" },
  { name: "Girafa",   chromeColor: "yellow" },
  { name: "Papagaio", chromeColor: "green" },
  { name: "Pantera",  chromeColor: "pink" },
  { name: "Polvo",    chromeColor: "purple" },
  { name: "Peixe",    chromeColor: "cyan" },
  { name: "Capivara", chromeColor: "orange" },
];

const STATE_DIR = join(homedir(), ".local", "share", "chrome-agent-mcp");
const COUNTER_FILE = join(STATE_DIR, "animal-counter.json");

const SHARED_COLORS = ["red", "blue", "green", "yellow", "purple", "orange", "pink", "cyan"];

const CLAUDE_TO_CHROME: Record<string, string> = {
  ...Object.fromEntries(SHARED_COLORS.map((c) => [c, c])),
  default: "grey",
};

const CHROME_TO_CLAUDE: Record<string, string> = {
  ...Object.fromEntries(SHARED_COLORS.map((c) => [c, c])),
  grey: "default",
};

function readCounter(): number {
  try {
    const data = JSON.parse(readFileSync(COUNTER_FILE, "utf8"));
    return typeof data.counter === "number" ? data.counter % ANIMALS.length : 0;
  } catch {
    return 0;
  }
}

function writeCounter(counter: number): void {
  try {
    mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(COUNTER_FILE, JSON.stringify({ counter }));
  } catch {}
}

export function nextAnimal(): AnimalEntry {
  const counter = readCounter();
  const animal = ANIMALS[counter];
  writeCounter((counter + 1) % ANIMALS.length);
  return animal;
}

export function isAnimalName(name: string): boolean {
  return ANIMALS.some((a) => name === a.name || name.startsWith(a.name + " "));
}

export function claudeToChrome(claudeColor: string): string | null {
  return CLAUDE_TO_CHROME[claudeColor.toLowerCase()] ?? null;
}

export function chromeToClaude(chromeColor: string): string | null {
  return CHROME_TO_CLAUDE[chromeColor.toLowerCase()] ?? null;
}

export const VALID_CLAUDE_COLORS = Object.keys(CLAUDE_TO_CHROME);
