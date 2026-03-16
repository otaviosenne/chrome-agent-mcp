export interface AnimalEntry {
    name: string;
    chromeColor: string;
}
export declare function nextAnimal(): AnimalEntry;
export declare function isAnimalName(name: string): boolean;
export declare function claudeToChrome(claudeColor: string): string | null;
export declare function chromeToClaude(chromeColor: string): string | null;
export declare const VALID_CLAUDE_COLORS: string[];
