# chrome-agent-mcp

MCP server for Chrome — gives Claude (or any MCP client) full control over your browser: multi-tab parallel execution, DevTools inspection, tab groups, screenshot capture, and a real-time dashboard via a companion Chrome extension.

## Features

- **Multi-tab parallel control** — open, switch, and operate multiple tabs simultaneously
- **Full browser automation** — click, type, scroll, fill forms, press keys, hover
- **DevTools access** — console logs, network requests, DOM elements, storage inspection
- **Tab groups** — isolate work into named groups (`CLAUDE #1`, `CLAUDE #2`, ...)
- **Live favicon animation** — tabs show a blinking Claude robot while the agent is active
- **Real-time dashboard** — companion extension shows active tabs, event log, and screenshots
- **Chrome window management** — list windows, focus specific windows, inspect extensions

## Requirements

- Node.js 18+
- Google Chrome (with remote debugging enabled)

## Installation

### 1. Start Chrome with remote debugging

```bash
google-chrome --remote-debugging-port=9222
```

Or add it to your Chrome shortcut/launcher permanently.

### 2. Install the MCP server

```bash
npx chrome-agent-mcp
```

Or install globally:

```bash
npm install -g chrome-agent-mcp
```

### 3. Add to your MCP client config

For Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "chrome-agent-mcp": {
      "command": "npx",
      "args": ["chrome-agent-mcp"],
      "env": {
        "CHROME_DEBUG_PORT": "9222"
      }
    }
  }
}
```

For Claude Code (`.claude/settings.json`):

```json
{
  "mcpServers": {
    "chrome-agent-mcp": {
      "command": "node",
      "args": ["/path/to/chrome-agent-mcp/dist/index.js"],
      "env": {
        "CHROME_DEBUG_PORT": "9222"
      }
    }
  }
}
```

### 4. Install the companion extension (optional but recommended)

1. Open Chrome → `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `extension/` folder

The extension adds a popup dashboard showing active tabs, agent events, and captured screenshots in real time.

## Available Tools

| Tool | Description |
|------|-------------|
| `browser_tabs` | Open, close, switch, list, and group tabs |
| `browser_navigate` | Navigate to a URL |
| `browser_navigate_back` / `browser_navigate_forward` | Browser history navigation |
| `browser_reload` | Reload the current tab |
| `browser_snapshot` | Get the accessibility tree of the page |
| `browser_take_screenshot` | Capture a screenshot |
| `browser_evaluate` | Execute JavaScript in the page |
| `browser_click` | Click an element |
| `browser_type` | Type text into an element |
| `browser_hover` | Hover over an element |
| `browser_press_key` | Press a keyboard key |
| `browser_scroll` | Scroll the page |
| `browser_select_option` | Select a dropdown option |
| `browser_fill_form` | Fill multiple form fields at once |
| `browser_wait_for` | Wait for an element or condition |
| `devtools_console` | Read browser console logs |
| `devtools_network` | Inspect network requests |
| `devtools_elements` | Inspect DOM elements |
| `devtools_storage` | Read cookies, localStorage, sessionStorage |
| `chrome_windows` | List all Chrome windows |
| `chrome_focus` | Focus a specific window |
| `chrome_extensions` | List installed extensions |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CHROME_DEBUG_PORT` | `9222` | Chrome remote debugging port |

## License

MIT
