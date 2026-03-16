const DOMAIN_MAP = {
    "github.com": "github",
    "gitlab.com": "gitlab",
    "console.aws.amazon.com": "aws console",
    "aws.amazon.com": "aws",
    "s3.amazonaws.com": "aws s3",
    "linkedin.com": "linkedin",
    "claude.ai": "claude",
    "anthropic.com": "anthropic",
    "npmjs.com": "npm",
    "vercel.com": "vercel",
    "netlify.com": "netlify",
    "heroku.com": "heroku",
    "stackoverflow.com": "stackoverflow",
    "google.com": "google",
    "gmail.com": "gmail",
    "notion.so": "notion",
    "figma.com": "figma",
    "jira.atlassian.com": "jira",
    "confluence.atlassian.com": "confluence",
    "trello.com": "trello",
    "slack.com": "slack",
    "discord.com": "discord",
    "twitter.com": "twitter",
    "x.com": "twitter",
    "reddit.com": "reddit",
    "youtube.com": "youtube",
    "stripe.com": "stripe",
    "supabase.com": "supabase",
    "railway.app": "railway",
    "render.com": "render",
    "cloudflare.com": "cloudflare",
    "digitalocean.com": "digitalocean",
};
const PATH_VERBS = [
    [/\/(login|signin|auth|oauth)/, "entrando"],
    [/\/(logout|signout)/, "saindo"],
    [/\/(setting|config|preferences)/, "configurando"],
    [/\/(billing|payment|invoice|pricing)/, "verificando"],
    [/\/(issue|bug|ticket|problem)/, "resolvendo"],
    [/\/(pull|pr|merge|review|diff)/, "revisando"],
    [/\/(deploy|release|publish|build|ci|pipeline)/, "publicando"],
    [/\/(new|create|add|register)/, "criando"],
    [/\/(edit|update|modify|change)/, "editando"],
    [/\/(delete|remove|destroy)/, "deletando"],
    [/\/(search|find|query|explore)/, "buscando"],
    [/\/(dashboard|home|overview|admin)/, "acessando"],
    [/\/(profile|account|user)/, "gerenciando"],
    [/\/(repo|repository|project)/, "no projeto"],
    [/\/(job|career|work|hiring)/, "buscando vagas"],
    [/\/(connection|network|contact)/, "em conexoes"],
    [/\/(message|chat|inbox|mail)/, "nas mensagens"],
    [/\/(test|spec|coverage)/, "testando"],
    [/\/(doc|docs|documentation|wiki|readme)/, "lendo docs"],
    [/\/(install|setup|getting-started)/, "instalando"],
    [/\/(api|graphql|rest|endpoint)/, "na api"],
    [/\/(log|logs|monitoring|analytics|metrics)/, "nos logs"],
    [/\/(storage|bucket|file|upload)/, "em arquivos"],
    [/\/(security|permission|policy|iam|role)/, "em permissoes"],
    [/\/(report|insight|stat|chart|graph)/, "em relatorios"],
];
const TOOL_VERBS = {
    browser_navigate: "abrindo",
    browser_click: "clicando",
    browser_type: "digitando",
    browser_fill_form: "preenchendo",
    browser_snapshot: "lendo",
    browser_take_screenshot: "capturando",
    browser_scroll: "rolando",
    browser_evaluate: "analisando",
    browser_wait_for: "aguardando",
    browser_hover: "inspecionando",
    browser_select_option: "selecionando",
    browser_press_key: "digitando",
    "browser_tabs:new": "abrindo tab",
    "browser_tabs:close": "fechando tab",
    "browser_tabs:done": "finalizando",
    "browser_tabs:switch": "alternando",
    devtools_console: "no console",
    devtools_network: "na rede",
    devtools_elements: "no dom",
    devtools_storage: "no storage",
};
function extractDomainLabel(url) {
    try {
        const { hostname, pathname } = new URL(url);
        const host = hostname.replace(/^www\./, "");
        for (const [key, label] of Object.entries(DOMAIN_MAP)) {
            if (host === key || host.endsWith(`.${key}`))
                return label;
        }
        const parts = host.split(".");
        if (parts.length >= 2)
            return parts[parts.length - 2];
        return host;
    }
    catch {
        return "";
    }
}
function extractPathVerb(url) {
    try {
        const { pathname } = new URL(url);
        const lower = pathname.toLowerCase();
        for (const [pattern, verb] of PATH_VERBS) {
            if (pattern.test(lower))
                return verb;
        }
    }
    catch { }
    return "";
}
function isInternalUrl(url) {
    return url.startsWith("chrome://") || url.startsWith("chrome-extension://") || url.startsWith("about:");
}
export function generateTabVerb(tool, args, tabUrl) {
    const url = args.url || tabUrl || "";
    if (isInternalUrl(url))
        return TOOL_VERBS[tool] || TOOL_VERBS[tool.split(":")[0]] || "usando";
    const pathVerb = extractPathVerb(url);
    return pathVerb || TOOL_VERBS[tool] || TOOL_VERBS[tool.split(":")[0]] || "usando";
}
export function generateDescription(tool, args, tabUrl) {
    const url = args.url || tabUrl || "";
    if (isInternalUrl(url))
        return TOOL_VERBS[tool] || TOOL_VERBS[tool.split(":")[0]] || "usando";
    const domain = extractDomainLabel(url);
    const verb = generateTabVerb(tool, args, tabUrl);
    const phrase = domain ? `${verb} ${domain}` : verb;
    return phrase.slice(0, 32);
}
