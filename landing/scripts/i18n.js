const TRANSLATIONS = {
  en: {
    'nav.how': 'How it works', 'nav.tools': 'Tools', 'nav.install': 'Install',
    'nav.github': 'GitHub', 'nav.install-btn': 'Install',
    'hero.badge': 'Model Context Protocol',
    'hero.line1': 'Give AI', 'hero.highlight': 'Full Control', 'hero.line2': 'of Chrome',
    'hero.subtitle': 'The MCP server that transforms Claude into a real browser agent — navigate, click, inspect, and automate with 23+ tools, real-time dashboard, and per-session tab isolation.',
    'hero.cta.primary': 'Get Started', 'hero.cta.secondary': 'View on GitHub',
    'hero.mock.header': 'MCP Dashboard', 'hero.mock.live': 'Live',
    'hero.mock.session': 'Pinguim', 'hero.mock.status': 'Active',
    'hero.float.tools': '23 MCP Tools', 'hero.float.isolated': 'Session Isolated',
    'stats.tools': 'MCP Tools', 'stats.categories': 'Tool Categories',
    'stats.sessions': 'Parallel Sessions', 'stats.coverage': 'Test Coverage',
    'hiw.badge': 'Setup in Minutes', 'hiw.title': 'How It Works',
    'hiw.subtitle': 'Three steps to give your AI agent full browser control',
    'hiw.s1.title': 'Enable Chrome Debugging',
    'hiw.s1.desc': 'Start Chrome with remote debugging enabled. One flag, permanent setup with a .desktop file.',
    'hiw.s2.title': 'Connect the MCP Server',
    'hiw.s2.desc': 'Add chrome-agent-mcp to your Claude settings. Run via npx — no global install required.',
    'hiw.s3.title': 'Watch Claude Browse',
    'hiw.s3.desc': 'Your AI agent gains full browser control. Navigate, click, fill forms, inspect DevTools — all autonomously.',
    'term.title': 'Claude Agent',
    'ses.badge': 'Session Isolation',
    'ses.title1': 'Parallel Agents,', 'ses.title2': 'Zero Conflicts',
    'ses.subtitle': 'Each Claude session gets its own Chrome tab group with a unique animal name and color — multiple agents run simultaneously without interfering.',
    'ses.active': 'Active', 'ses.idle': 'Idle',
    'ses.note': 'Animal names are automatically assigned — Penguin, Phoenix, Giraffe, and dozens more. Each session owns its group from start to finish.',
    'tools.badge': '23+ MCP Tools',
    'tools.title1': 'Every Tool Your', 'tools.title2': 'Agent Needs',
    'tools.subtitle': 'A complete browser automation toolkit in six specialized categories',
    'tools.cat.nav': 'Navigation', 'tools.cat.inter': 'Interaction',
    'tools.cat.insp': 'Inspection', 'tools.cat.tabs': 'Tab Management',
    'tools.cat.devtools': 'DevTools', 'tools.cat.browser': 'Browser Control',
    'ext.badge': 'Chrome Extension',
    'ext.title1': 'Watch Your AI Browse', 'ext.title2': 'in Real Time',
    'ext.subtitle': "The companion extension gives you full visibility into what your agent is doing — live tab tracking, event logs, and screenshots as they're captured.",
    'ext.f1.title': 'Live Tab Tracking',
    'ext.f1.desc': 'See every tab your AI opens, with live activity indicators and session labels.',
    'ext.f2.title': 'Real-time Event Log',
    'ext.f2.desc': 'A scrolling log of every tool call — navigate, click, type — with timestamps.',
    'ext.f3.title': 'Screenshot Preview',
    'ext.f3.desc': 'Thumbnail previews of captured screenshots appear instantly in the popup.',
    'res.badge': 'Built for Reliability', 'res.title': 'Resilient by Design',
    'res.subtitle': 'Every tool call goes through a layered fault-tolerance system so your agent never gets stuck',
    'res.s1.label': 'Primary', 'res.s1.title': '20s Timeout',
    'res.s1.desc': 'A generous primary timeout handles slow pages and heavy DOM operations.',
    'res.s2.label': 'Retry', 'res.s2.title': '2× Parallel Retries',
    'res.s2.desc': 'On timeout: two concurrent retries at 10s. Reads are parallel, writes sequential.',
    'res.s3.label': 'Fallback', 'res.s3.title': 'New Group Fallback',
    'res.s3.desc': 'If all retries fail, a fresh Chrome group is created and the agent continues seamlessly.',
    'inst.badge': 'Quick Setup',
    'inst.title1': 'Up and Running', 'inst.title2': 'in 2 Minutes',
    'inst.subtitle': 'Four steps to give your Claude agent full browser control',
    'inst.s1': '1. Launch Chrome with remote debugging',
    'inst.s2': '2. Run the MCP server',
    'inst.s3': '3. Add to Claude Desktop config',
    'inst.s4': '4. Install the extension (optional)',
    'inst.s4.desc': 'Open chrome://extensions → Enable Developer mode → Load unpacked → select the extension/ folder',
    'cta.title1': 'Ready to Give Claude', 'cta.title2': 'the Browser?',
    'cta.subtitle': 'Open source · MIT License · One command to start',
    'cta.github': 'View on GitHub', 'cta.npm': 'View on npm',
    'foot.tagline': 'Full Chrome control for AI agents via the Model Context Protocol',
    'foot.links': 'Links', 'foot.github': 'GitHub', 'foot.npm': 'npm',
    'foot.license': 'MIT License', 'foot.author': 'by Otavio Senne',
    'copy.btn': 'Copy',
  },
  pt: {
    'nav.how': 'Como funciona', 'nav.tools': 'Ferramentas', 'nav.install': 'Instalar',
    'nav.github': 'GitHub', 'nav.install-btn': 'Instalar',
    'hero.badge': 'Model Context Protocol',
    'hero.line1': 'Dê à IA', 'hero.highlight': 'Controle Total', 'hero.line2': 'do Chrome',
    'hero.subtitle': 'O servidor MCP que transforma o Claude em um agente real de navegador — navegue, clique, inspecione e automatize com 23+ ferramentas, dashboard em tempo real e isolamento de sessões.',
    'hero.cta.primary': 'Começar', 'hero.cta.secondary': 'Ver no GitHub',
    'hero.mock.header': 'Painel MCP', 'hero.mock.live': 'Ao Vivo',
    'hero.mock.session': 'Pinguim', 'hero.mock.status': 'Ativo',
    'hero.float.tools': '23 Ferramentas MCP', 'hero.float.isolated': 'Sessão Isolada',
    'stats.tools': 'Ferramentas MCP', 'stats.categories': 'Categorias',
    'stats.sessions': 'Sessões Paralelas', 'stats.coverage': 'Cobertura de Testes',
    'hiw.badge': 'Configure em Minutos', 'hiw.title': 'Como Funciona',
    'hiw.subtitle': 'Três passos para dar ao seu agente IA controle total do navegador',
    'hiw.s1.title': 'Habilite o Debug do Chrome',
    'hiw.s1.desc': 'Inicie o Chrome com debug remoto habilitado. Uma flag, configuração permanente com arquivo .desktop.',
    'hiw.s2.title': 'Conecte o Servidor MCP',
    'hiw.s2.desc': 'Adicione o chrome-agent-mcp à sua configuração do Claude. Execute com npx — sem instalação global.',
    'hiw.s3.title': 'Veja o Claude Navegar',
    'hiw.s3.desc': 'Seu agente IA obtém controle total do navegador. Navegue, clique, preencha formulários — tudo de forma autônoma.',
    'term.title': 'Agente Claude',
    'ses.badge': 'Isolamento de Sessões',
    'ses.title1': 'Agentes Paralelos,', 'ses.title2': 'Zero Conflitos',
    'ses.subtitle': 'Cada sessão do Claude recebe seu próprio grupo de abas com um nome de animal único e cor — múltiplos agentes rodam simultaneamente sem interferir uns nos outros.',
    'ses.active': 'Ativo', 'ses.idle': 'Ocioso',
    'ses.note': 'Nomes de animais são atribuídos automaticamente — Pinguim, Fênix, Girafa e dezenas de outros. Cada sessão possui seu grupo do início ao fim.',
    'tools.badge': '23+ Ferramentas MCP',
    'tools.title1': 'Toda Ferramenta Que', 'tools.title2': 'Seu Agente Precisa',
    'tools.subtitle': 'Um kit completo de automação de navegador em seis categorias especializadas',
    'tools.cat.nav': 'Navegação', 'tools.cat.inter': 'Interação',
    'tools.cat.insp': 'Inspeção', 'tools.cat.tabs': 'Gerenc. de Abas',
    'tools.cat.devtools': 'DevTools', 'tools.cat.browser': 'Controle do Navegador',
    'ext.badge': 'Extensão Chrome',
    'ext.title1': 'Veja Sua IA Navegar', 'ext.title2': 'em Tempo Real',
    'ext.subtitle': 'A extensão parceira dá visibilidade total do que seu agente está fazendo — rastreamento de abas, logs de eventos e capturas de tela em tempo real.',
    'ext.f1.title': 'Rastreamento de Abas ao Vivo',
    'ext.f1.desc': 'Veja cada aba que sua IA abre, com indicadores de atividade ao vivo e labels de sessão.',
    'ext.f2.title': 'Log de Eventos em Tempo Real',
    'ext.f2.desc': 'Um log rolante de cada chamada de ferramenta — navegar, clicar, digitar — com timestamps.',
    'ext.f3.title': 'Preview de Screenshots',
    'ext.f3.desc': 'Miniaturas das capturas de tela aparecem instantaneamente no painel.',
    'res.badge': 'Construído para Confiabilidade', 'res.title': 'Resiliente por Design',
    'res.subtitle': 'Cada chamada de ferramenta passa por um sistema de tolerância a falhas em camadas para que seu agente nunca trave',
    'res.s1.label': 'Primário', 'res.s1.title': 'Timeout de 20s',
    'res.s1.desc': 'Um timeout primário generoso lida com páginas lentas e operações pesadas no DOM.',
    'res.s2.label': 'Retry', 'res.s2.title': '2× Retries Paralelos',
    'res.s2.desc': 'No timeout: dois retries de 10s cada. Leituras em paralelo, escritas sequenciais.',
    'res.s3.label': 'Fallback', 'res.s3.title': 'Fallback para Novo Grupo',
    'res.s3.desc': 'Se todos os retries falharem, um novo grupo Chrome é criado e o agente continua.',
    'inst.badge': 'Configuração Rápida',
    'inst.title1': 'Pronto em', 'inst.title2': '2 Minutos',
    'inst.subtitle': 'Quatro passos para dar ao seu agente Claude controle total do navegador',
    'inst.s1': '1. Inicie o Chrome com debug remoto',
    'inst.s2': '2. Execute o servidor MCP',
    'inst.s3': '3. Adicione à config do Claude Desktop',
    'inst.s4': '4. Instale a extensão (opcional)',
    'inst.s4.desc': 'Abra chrome://extensions → Modo Desenvolvedor → Carregar sem compactação → selecione a pasta extension/',
    'cta.title1': 'Pronto para Dar ao Claude', 'cta.title2': 'o Navegador?',
    'cta.subtitle': 'Código aberto · Licença MIT · Um comando para começar',
    'cta.github': 'Ver no GitHub', 'cta.npm': 'Ver no npm',
    'foot.tagline': 'Controle total do Chrome para agentes IA via Model Context Protocol',
    'foot.links': 'Links', 'foot.github': 'GitHub', 'foot.npm': 'npm',
    'foot.license': 'Licença MIT', 'foot.author': 'por Otavio Senne',
    'copy.btn': 'Copiar',
  },
};

let currentLang = localStorage.getItem('lang') || 'en';

function applyTranslations(lang) {
  document.documentElement.setAttribute('lang', lang);
  document.documentElement.setAttribute('data-lang', lang);
  const t = TRANSLATIONS[lang];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key] !== undefined) el.textContent = t[key];
  });
}

function toggleLanguage() {
  currentLang = currentLang === 'en' ? 'pt' : 'en';
  localStorage.setItem('lang', currentLang);
  applyTranslations(currentLang);
  updateLangButton();
}

function updateLangButton() {
  const btn = document.getElementById('lang-toggle');
  if (!btn) return;
  btn.querySelector('.lang-current').textContent = currentLang.toUpperCase();
  btn.querySelector('.lang-other').textContent = currentLang === 'en' ? 'PT' : 'EN';
}

document.addEventListener('DOMContentLoaded', () => {
  applyTranslations(currentLang);
  updateLangButton();
  const btn = document.getElementById('lang-toggle');
  if (btn) btn.addEventListener('click', toggleLanguage);
});
