const CLAUDE_TO_CHROME = {
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
const CHROME_TO_CLAUDE = {
    purple: "purple",
    cyan: "teal",
    green: "green",
    yellow: "yellow",
    red: "red",
    pink: "pink",
    blue: "blue",
    grey: "grey",
};
export function claudeToChrome(claudeColor) {
    return CLAUDE_TO_CHROME[claudeColor.toLowerCase()] ?? null;
}
export function chromeToClaude(chromeColor) {
    return CHROME_TO_CLAUDE[chromeColor.toLowerCase()] ?? null;
}
export const VALID_CLAUDE_COLORS = Object.keys(CLAUDE_TO_CHROME).filter((k) => k !== "gray");
