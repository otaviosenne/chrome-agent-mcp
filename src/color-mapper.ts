const SHARED_COLORS = ["red", "blue", "green", "yellow", "purple", "orange", "pink", "cyan"];

const CLAUDE_TO_CHROME: Record<string, string> = {
  ...Object.fromEntries(SHARED_COLORS.map((c) => [c, c])),
  default: "grey",
};

const CHROME_TO_CLAUDE: Record<string, string> = {
  ...Object.fromEntries(SHARED_COLORS.map((c) => [c, c])),
  grey: "default",
};

export function claudeToChrome(claudeColor: string): string | null {
  return CLAUDE_TO_CHROME[claudeColor.toLowerCase()] ?? null;
}

export function chromeToClaude(chromeColor: string): string | null {
  return CHROME_TO_CLAUDE[chromeColor.toLowerCase()] ?? null;
}

export const VALID_CLAUDE_COLORS = Object.keys(CLAUDE_TO_CHROME);
