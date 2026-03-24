export const devtoolsElementsToolDefinition = {
    name: "devtools_elements",
    description: "Inspect DOM elements and computed CSS styles for a tab. Equivalent to the DevTools Elements panel.",
    inputSchema: {
        type: "object",
        properties: {
            selector: {
                type: "string",
                description: "CSS selector of the element to inspect",
            },
            includeStyles: {
                type: "boolean",
                description: "Include computed CSS styles (default: false)",
            },
            tabId: {
                type: "string",
                description: "Target tab ID (from browser_tabs list). Uses active tab if omitted.",
            },
            agentId: {
                type: "string",
                description: "Agent identifier for parallel execution. Pass a unique ID (e.g. 'C1', 'J2') — the server automatically routes calls to this agent's dedicated tab (registered via browser_tabs action=new).",
            },
        },
        required: ["selector"],
    },
};
export async function handleDevtoolsElements(args, connection) {
    const client = await connection.getClient(args.tabId);
    const selector = args.selector;
    const includeStyles = args.includeStyles ?? false;
    const { result } = await client.Runtime.evaluate({
        expression: `
      (() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return null;
        const attrs = {};
        for (const a of el.attributes) attrs[a.name] = a.value;
        return JSON.stringify({
          tag: el.tagName.toLowerCase(),
          id: el.id || null,
          classes: Array.from(el.classList),
          attributes: attrs,
          textContent: el.textContent?.trim().substring(0, 200) || null,
          outerHTML: el.outerHTML?.substring(0, 500) || null,
          rect: (() => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) }; })(),
          childCount: el.children.length,
        });
      })()
    `,
        returnByValue: true,
    });
    if (!result.value) {
        return { content: [{ type: "text", text: `No element found for selector: ${selector}` }], isError: true };
    }
    const info = JSON.parse(result.value);
    let output = `Element: ${selector}\n`;
    output += `  Tag: <${info.tag}>\n`;
    if (info.id)
        output += `  ID: ${info.id}\n`;
    if (info.classes.length)
        output += `  Classes: ${info.classes.join(", ")}\n`;
    output += `  Size: ${info.rect.width}x${info.rect.height} at (${info.rect.x}, ${info.rect.y})\n`;
    output += `  Children: ${info.childCount}\n`;
    if (info.textContent)
        output += `  Text: "${info.textContent}"\n`;
    const attrKeys = Object.keys(info.attributes).filter((k) => k !== "class" && k !== "id");
    if (attrKeys.length) {
        output += `  Attributes:\n`;
        for (const k of attrKeys)
            output += `    ${k}="${info.attributes[k]}"\n`;
    }
    if (includeStyles) {
        const { result: stylesResult } = await client.Runtime.evaluate({
            expression: `
        (() => {
          const el = document.querySelector(${JSON.stringify(selector)});
          if (!el) return null;
          const s = window.getComputedStyle(el);
          const keys = ["display","position","width","height","margin","padding","color","background-color","font-size","font-family","border","flex","grid","z-index","opacity","visibility","overflow"];
          const styles = {};
          for (const k of keys) styles[k] = s.getPropertyValue(k);
          return JSON.stringify(styles);
        })()
      `,
            returnByValue: true,
        });
        if (stylesResult.value) {
            const styles = JSON.parse(stylesResult.value);
            output += `\nComputed Styles:\n`;
            for (const [k, v] of Object.entries(styles)) {
                if (v)
                    output += `  ${k}: ${v}\n`;
            }
        }
    }
    return { content: [{ type: "text", text: output }] };
}
