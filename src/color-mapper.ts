const CLAUDE_TO_CHROME: Record<string, string> = {
  red: "red",
  blue: "blue",
  green: "green",
  yellow: "yellow",
  purple: "purple",
  orange: "orange",
  pink: "pink",
  cyan: "cyan",
  default: "grey",
};

const CHROME_TO_CLAUDE: Record<string, string> = {
  red: "red",
  blue: "blue",
  green: "green",
  yellow: "yellow",
  purple: "purple",
  orange: "orange",
  pink: "pink",
  cyan: "cyan",
  grey: "default",
};

export function claudeToChrome(claudeColor: string): string | null {
  return CLAUDE_TO_CHROME[claudeColor.toLowerCase()] ?? null;
}

export function chromeToClaude(chromeColor: string): string | null {
  return CHROME_TO_CLAUDE[chromeColor.toLowerCase()] ?? null;
}

export const VALID_CLAUDE_COLORS = Object.keys(CLAUDE_TO_CHROME);
