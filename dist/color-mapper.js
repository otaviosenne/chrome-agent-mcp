const CLAUDE_TO_CHROME = {
    red: "red",
    blue: "blue",
    green: "green",
    yellow: "yellow",
    purple: "purple",
    orange: "yellow",
    pink: "pink",
    cyan: "cyan",
    default: "grey",
};
const CHROME_TO_CLAUDE = {
    red: "red",
    blue: "blue",
    green: "green",
    yellow: "yellow",
    purple: "purple",
    pink: "pink",
    cyan: "cyan",
    grey: "default",
};
export function claudeToChrome(claudeColor) {
    return CLAUDE_TO_CHROME[claudeColor.toLowerCase()] ?? null;
}
export function chromeToClaude(chromeColor) {
    return CHROME_TO_CLAUDE[chromeColor.toLowerCase()] ?? null;
}
export const VALID_CLAUDE_COLORS = Object.keys(CLAUDE_TO_CHROME);
