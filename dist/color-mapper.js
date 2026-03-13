const SHARED_COLORS = ["red", "blue", "green", "yellow", "purple", "orange", "pink", "cyan"];
const CLAUDE_TO_CHROME = {
    ...Object.fromEntries(SHARED_COLORS.map((c) => [c, c])),
    default: "grey",
};
const CHROME_TO_CLAUDE = {
    ...Object.fromEntries(SHARED_COLORS.map((c) => [c, c])),
    grey: "default",
};
export function claudeToChrome(claudeColor) {
    return CLAUDE_TO_CHROME[claudeColor.toLowerCase()] ?? null;
}
export function chromeToClaude(chromeColor) {
    return CHROME_TO_CLAUDE[chromeColor.toLowerCase()] ?? null;
}
export const VALID_CLAUDE_COLORS = Object.keys(CLAUDE_TO_CHROME);
