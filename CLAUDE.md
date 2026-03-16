# CLAUDE.md — chrome-agent-mcp

## Project Purpose

MCP server that gives AI agents full control over Chrome: navigation,
interaction, DevTools inspection, tab groups, and session management.
One server instance = one isolated Chrome group per Claude session.

---

## Hard Rules

1. No file may exceed **300 lines**
2. No directory may have more than **7 items** (files + subdirectories)
3. Every function has **one clearly defined responsibility** (SRP)
4. No inline comments — code must be self-documenting
5. No magic numbers — use named constants
6. All code, names, and docs in **English**

---

## SOLID Application

| Principle | How it applies here |
|-----------|---------------------|
| **S** — Single Responsibility | Each module owns one concern: `connection.ts` only manages CDP, `state.ts` only handles persistence |
| **O** — Open/Closed | New tools added via `toolHandlers` map — no changes to dispatch logic |
| **L** — Liskov | `ToolHandler` type is consistent across all tools |
| **I** — Interface Segregation | Small focused interfaces (`BridgeEvent`, `PersistedState`) over large ones |
| **D** — Dependency Inversion | Tools receive `ChromeConnection` abstraction, never import CDP directly |

---

## Architecture

```
src/
  index.ts          # MCP server + request dispatch
  types.ts          # Shared type definitions
  core/             # Infrastructure layer (5 items)
    connection.ts   # Chrome CDP connection lifecycle
    bridge.ts       # Extension event bridge
    favicon.ts      # Tab favicon animation
    resilience.ts   # Timeout/retry/fallback execution wrapper
    groups/         # Tab group isolation (3 items)
      manager.ts    # Orchestrator (public API)
      state.ts      # File-based persistence
      chrome-api.ts # Chrome Extension API calls
  tools/            # MCP tool implementations (7 items)
    tabs.ts         # Tab list/open/close/switch/done
    navigation.ts   # navigate/back/forward/reload
    browser.ts      # windows/focus/extensions
    media.ts        # screenshot/snapshot/evaluate
    session.ts      # session sync
    interaction/    # Browser interaction (4 items)
      index.ts      # Re-exports
      input.ts      # click/hover/type/pressKey
      form.ts       # scroll/selectOption/fillForm
      wait.ts       # waitFor
    devtools/       # DevTools inspection (4 items)
      console.ts
      network.ts
      elements.ts
      storage.ts
  utils/            # Pure utility functions (3 items)
    accessibility.ts  # AX tree formatting
    description.ts    # Tab action descriptions
    identity.ts       # Animal names + Chrome colors

tests/              # Vitest unit tests (mirrors src/ structure)
  core/
  tools/
  utils/
```

---

## Key Abstractions

- **ChromeConnection** — single point of entry for all CDP operations
- **TabGroupManager** — one Chrome group per Claude session; owns isolation
- **ExtensionBridge** — emits events to the Chrome extension popup UI
- **executeResilient** — wraps every tool call:
  `20s primary → 2× retries (parallel for reads, sequential for writes) → new group fallback`

---

## Adding a New Tool

1. Create `src/tools/<name>.ts`:
   ```ts
   export const <name>ToolDefinition: Tool = { ... };
   export async function handle<Name>(
     args: Record<string, unknown>,
     connection: ChromeConnection
   ): Promise<ToolResult> { ... }
   ```
2. Register in `src/index.ts`: add to `toolHandlers` map and `allTools` array
3. If idempotent (read-only), add to `IDEMPOTENT_TOOLS` set in `index.ts`
4. Add tests in `tests/tools/<name>.test.ts`

---

## Testing

```bash
npm test          # run all tests
npm run coverage  # run with coverage (target: 80% lines/functions/statements)
npm run test:watch
```

Tests use **Vitest**. Mock `ChromeConnection` via the class interface — never
instantiate a real CDP connection in tests. Use `vi.fn()` for all CDP calls.

---

## Build

```bash
npm run build   # TypeScript → dist/
npm run dev     # watch mode
npm start       # run the server
```
