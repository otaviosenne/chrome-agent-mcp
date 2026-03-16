<div align="center">

# chrome-agent-mcp

**Full Chrome control for AI agents via the Model Context Protocol**

[![npm](https://img.shields.io/npm/v/chrome-agent-mcp)](https://www.npmjs.com/package/chrome-agent-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

Give Claude (or any MCP client) full control over your browser: navigate pages,
click elements, fill forms, inspect DevTools — with parallel tab execution,
session isolation per agent, and a real-time dashboard.

</div>

---

## What it does

Each Claude session gets its **own Chrome tab group** — so multiple agents can
run in parallel without stepping on each other. A companion Chrome extension
shows a live dashboard: active tabs, event log, and screenshots in real time.

```
Claude session A  →  tab group "Pinguim"  (blue)
Claude session B  →  tab group "Fenix"   (red)
Claude session C  →  tab group "Girafa"  (yellow)
```

Every tool call is wrapped with **resilient execution**:
- 20 s primary timeout
- 2× parallel retries on timeout (10 s each)
- Automatic fallback to a new Chrome group if all retries fail

---

## Requirements

- **Node.js** ≥ 18
- **Google Chrome** with remote debugging enabled

---

## Installation

### 1. Enable Chrome remote debugging

```bash
google-chrome --remote-debugging-port=9222
```

To make it permanent, add the flag to your Chrome launcher or `.desktop` file.

### 2. Install the MCP server

```bash
# Run directly (no install)
npx chrome-agent-mcp

# Or install globally
npm install -g chrome-agent-mcp
```

### 3. Configure your MCP client

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "chrome-agent-mcp": {
      "command": "npx",
      "args": ["chrome-agent-mcp"],
      "env": { "CHROME_DEBUG_PORT": "9222" }
    }
  }
}
```

**Claude Code** (`.claude/settings.json`):

```json
{
  "mcpServers": {
    "chrome-agent-mcp": {
      "command": "node",
      "args": ["/path/to/chrome-agent-mcp/dist/index.js"],
      "env": { "CHROME_DEBUG_PORT": "9222" }
    }
  }
}
```

### 4. Install the companion extension *(optional but recommended)*

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `extension/` folder

The extension adds a popup dashboard showing which tabs are active, what the
agent is doing, and captured screenshots — all updating in real time.

---

## Available Tools

### Navigation

| Tool | Description |
|------|-------------|
| `browser_navigate` | Navigate to a URL |
| `browser_navigate_back` | Go back in browser history |
| `browser_navigate_forward` | Go forward in browser history |
| `browser_reload` | Reload the current tab |

### Interaction

| Tool | Description |
|------|-------------|
| `browser_click` | Click an element by accessibility ref |
| `browser_type` | Type text into a focused element |
| `browser_hover` | Hover over an element |
| `browser_press_key` | Press a keyboard key or shortcut |
| `browser_scroll` | Scroll the page or an element |
| `browser_select_option` | Select a `<select>` dropdown option |
| `browser_fill_form` | Fill multiple form fields at once |
| `browser_wait_for` | Wait for an element or condition |

### Page Inspection

| Tool | Description |
|------|-------------|
| `browser_snapshot` | Get the accessibility tree of the page |
| `browser_take_screenshot` | Capture a full-page screenshot |
| `browser_evaluate` | Execute JavaScript and return the result |

### Tab Management

| Tool | Description |
|------|-------------|
| `browser_tabs` | Open, close, switch, list, and mark tabs done |

### DevTools

| Tool | Description |
|------|-------------|
| `devtools_console` | Read and clear browser console logs |
| `devtools_network` | Inspect network requests and responses |
| `devtools_elements` | Inspect and query DOM elements |
| `devtools_storage` | Read cookies, localStorage, sessionStorage |

### Browser Management

| Tool | Description |
|------|-------------|
| `chrome_windows` | List all open Chrome windows |
| `chrome_focus` | Focus a specific window |
| `chrome_extensions` | List installed Chrome extensions |
| `session_sync` | Sync session state with the extension dashboard |

---

## Architecture

```
src/
├── index.ts              MCP server + request dispatch
├── types.ts              Shared type definitions
├── core/                 Infrastructure layer
│   ├── connection.ts     Chrome CDP connection lifecycle
│   ├── bridge.ts         Extension event bridge
│   ├── favicon.ts        Tab favicon animation manager
│   ├── resilience.ts     Timeout / retry / fallback execution
│   └── groups/           Tab group isolation
│       ├── manager.ts    Orchestrator (public API)
│       ├── state.ts      File-based state persistence
│       └── chrome-api.ts Chrome Extension API bridge
├── tools/                MCP tool implementations
│   ├── tabs.ts
│   ├── navigation.ts
│   ├── browser.ts
│   ├── media.ts          screenshot · snapshot · evaluate
│   ├── session.ts
│   ├── interaction/      click · type · hover · scroll · form · wait
│   └── devtools/         console · network · elements · storage
└── utils/                Pure utility functions
    ├── accessibility.ts  AX tree formatter
    ├── description.ts    Tab action labels
    └── identity.ts       Animal names + Chrome group colors
```

**Engineering rules:** every file ≤ 300 lines · every directory ≤ 7 items · SOLID principles throughout.

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `CHROME_DEBUG_PORT` | `9222` | Chrome remote debugging port |

---

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Watch mode
npm run dev

# Run tests
npm test

# Coverage report (target: 80%)
npm run coverage
```

---

## License

MIT © [Otavio Senne](https://github.com/otaviosenne)
