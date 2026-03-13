const CLAUDE_TO_CHROME: Record<string, string> = {
  purple: "purple",
  teal: "cyan",
  green: "green",
  yellow: "yellow",
  orange: "yellow",
  red: "red",
  pink: "pink",
  blue: "blue",
  grey: "grey",
  gray: "grey",
};

const CHROME_TO_CLAUDE: Record<string, string> = {
  purple: "purple",
  cyan: "teal",
  green: "green",
  yellow: "yellow",
  red: "red",
  pink: "pink",
  blue: "blue",
  grey: "grey",
};

export function claudeToChrome(claudeColor: string): string | null {
  return CLAUDE_TO_CHROME[claudeColor.toLowerCase()] ?? null;
}

export function chromeToClaude(chromeColor: string): string | null {
  return CHROME_TO_CLAUDE[chromeColor.toLowerCase()] ?? null;
}

export const VALID_CLAUDE_COLORS = Object.keys(CLAUDE_TO_CHROME).filter(
  (k) => k !== "gray"
);
