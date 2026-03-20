document.addEventListener('DOMContentLoaded', () => {
  if (typeof gsap === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger);

  gsap.timeline({ delay: 0.2 })
    .from('.hero-badge', { opacity: 0, y: 20, duration: 0.5 })
    .from('.hero-title', { opacity: 0, y: 40, duration: 0.8 }, '-=0.2')
    .from('.hero-sub', { opacity: 0, y: 20, duration: 0.6 }, '-=0.4')
    .from('.hero-ctas', { opacity: 0, y: 20, duration: 0.5 }, '-=0.3')
    .from('.hero-note', { opacity: 0, y: 10, duration: 0.4 }, '-=0.2')
    .from('.mock-window', { opacity: 0, x: 60, duration: 0.9, ease: 'power3.out' }, '-=0.7')
    .from('.hero-float-badge', { opacity: 0, scale: 0.8, duration: 0.4, stagger: 0.15 }, '-=0.4')
    .from('.scroll-line', { scaleY: 0, duration: 0.6, transformOrigin: 'top' }, '-=0.2');

  gsap.from('.stat-item', {
    scrollTrigger: { trigger: '.stats-bar', start: 'top 85%' },
    opacity: 0, y: 30, duration: 0.5, stagger: 0.1,
  });

  document.querySelectorAll('.counter').forEach(el => {
    const target = parseInt(el.getAttribute('data-target'));
    const suffix = el.getAttribute('data-suffix') || '';
    ScrollTrigger.create({
      trigger: el, start: 'top 85%', once: true,
      onEnter: () => gsap.to({ val: 0 }, {
        val: target, duration: 1.5, ease: 'power2.out',
        onUpdate() { el.textContent = Math.round(this.targets()[0].val) + suffix; },
      }),
    });
  });

  gsap.utils.toArray('.section-badge').forEach(el =>
    gsap.from(el, { scrollTrigger: { trigger: el, start: 'top 88%' }, opacity: 0, y: 15, duration: 0.4 })
  );
  gsap.utils.toArray('.section-title').forEach(el =>
    gsap.from(el, { scrollTrigger: { trigger: el, start: 'top 85%' }, opacity: 0, y: 30, duration: 0.7 })
  );
  gsap.utils.toArray('.section-sub').forEach(el =>
    gsap.from(el, { scrollTrigger: { trigger: el, start: 'top 85%' }, opacity: 0, y: 20, duration: 0.5 })
  );

  gsap.utils.toArray('.step-card').forEach((el, i) =>
    gsap.from(el, { scrollTrigger: { trigger: el, start: 'top 82%' }, opacity: 0, y: 50, duration: 0.6, delay: i * 0.12 })
  );
  gsap.utils.toArray('.session-card').forEach((el, i) =>
    gsap.from(el, { scrollTrigger: { trigger: el, start: 'top 82%' }, opacity: 0, scale: 0.92, y: 30, duration: 0.6, delay: i * 0.15 })
  );
  gsap.utils.toArray('.tool-category').forEach((el, i) =>
    gsap.from(el, { scrollTrigger: { trigger: el, start: 'top 85%' }, opacity: 0, y: 35, duration: 0.55, delay: i * 0.07 })
  );
  gsap.utils.toArray('.ext-feature').forEach((el, i) =>
    gsap.from(el, { scrollTrigger: { trigger: el, start: 'top 85%' }, opacity: 0, x: -25, duration: 0.5, delay: i * 0.12 })
  );
  gsap.from('.ext-screenshot', {
    scrollTrigger: { trigger: '.ext-screenshot', start: 'top 80%' },
    opacity: 0, x: 50, duration: 0.8, ease: 'power2.out',
  });
  gsap.utils.toArray('.res-step').forEach((el, i) =>
    gsap.from(el, { scrollTrigger: { trigger: el, start: 'top 82%' }, opacity: 0, y: 30, duration: 0.5, delay: i * 0.15 })
  );
  gsap.utils.toArray('.install-step').forEach((el, i) =>
    gsap.from(el, { scrollTrigger: { trigger: el, start: 'top 85%' }, opacity: 0, y: 25, duration: 0.5, delay: i * 0.1 })
  );
  gsap.from('.cta-box', {
    scrollTrigger: { trigger: '.cta-box', start: 'top 80%' },
    opacity: 0, scale: 0.95, duration: 0.7, ease: 'power2.out',
  });

  document.querySelectorAll('[data-tilt]').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const rx = ((e.clientY - rect.top) / rect.height - 0.5) * -10;
      const ry = ((e.clientX - rect.left) / rect.width - 0.5) * 10;
      card.style.transform = `perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(8px)`;
    });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; });
  });

  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 60);
  }, { passive: true });

  const termLines = [
    '> browser_navigate("https://docs.anthropic.com")',
    '  ✓ Navigated successfully',
    '> browser_snapshot()',
    '  ✓ Found 52 interactive elements',
    '> browser_click("get-started-btn")',
    '  ✓ Clicked: "Get Started" button',
    '> browser_fill_form({ email: "ai@agent.io" })',
    '  ✓ Filled 1 field',
    '> browser_take_screenshot()',
    '  ✓ Screenshot: 1280×800px captured',
  ];

  const termBody = document.querySelector('.terminal-body');
  if (termBody) {
    let li = 0, ci = 0, el = null;
    function type() {
      if (li >= termLines.length) {
        setTimeout(() => { termBody.innerHTML = ''; li = 0; ci = 0; el = null; type(); }, 2500);
        return;
      }
      const line = termLines[li];
      if (ci === 0) {
        el = document.createElement('div');
        el.className = 'term-line ' + (line.trim().startsWith('✓') ? 'ok' : 'cmd');
        termBody.appendChild(el);
        termBody.scrollTop = termBody.scrollHeight;
      }
      if (ci < line.length) {
        el.textContent += line[ci++];
        setTimeout(type, line.trim().startsWith('✓') ? 15 : 28 + Math.random() * 18);
      } else {
        li++; ci = 0;
        setTimeout(type, line.trim().startsWith('✓') ? 350 : 120);
      }
    }
    ScrollTrigger.create({
      trigger: termBody, start: 'top 75%', once: true, onEnter: type,
    });
  }
});
