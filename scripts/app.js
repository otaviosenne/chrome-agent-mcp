document.addEventListener('DOMContentLoaded', () => {
  let theme = localStorage.getItem('theme') || 'dark';

  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('theme', t);
    theme = t;
    const icon = document.querySelector('#theme-toggle .theme-icon');
    if (icon) icon.textContent = t === 'dark' ? '☀️' : '🌙';
    const hljsLink = document.getElementById('hljs-theme');
    if (hljsLink) {
      hljsLink.href = t === 'dark'
        ? 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css'
        : 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css';
    }
  }

  applyTheme(theme);

  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) themeBtn.addEventListener('click', () => applyTheme(theme === 'dark' ? 'light' : 'dark'));

  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }); }
    });
  });

  function setupCopyButtons() {
    document.querySelectorAll('.code-copy').forEach(btn => {
      btn.addEventListener('click', () => {
        const codeEl = btn.closest('.code-block, .cta-cmd')?.querySelector('code');
        if (!codeEl) return;
        navigator.clipboard.writeText(codeEl.textContent.trim()).then(() => {
          const orig = btn.textContent;
          btn.textContent = '✓';
          btn.classList.add('copied');
          setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 2000);
        });
      });
    });
  }

  setupCopyButtons();

  if (typeof hljs !== 'undefined') hljs.highlightAll();

  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-link[href^="#"]');
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navLinks.forEach(link => {
          link.classList.toggle('active', link.getAttribute('href') === '#' + entry.target.id);
        });
      }
    });
  }, { threshold: 0.35 });
  sections.forEach(s => io.observe(s));

  const mockLog = document.querySelector('.mock-log');
  if (mockLog) {
    const entries = mockLog.querySelectorAll('.mock-log-entry');
    let idx = 0;
    setInterval(() => {
      entries.forEach(e => e.classList.remove('active-log'));
      entries[idx % entries.length].classList.add('active-log');
      idx++;
    }, 1800);
  }

  const pulseDot = document.querySelector('.mock-loading-dot');
  if (pulseDot) {
    setInterval(() => { pulseDot.classList.toggle('visible'); }, 600);
  }
});
