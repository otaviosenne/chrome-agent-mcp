const CURSOR_ID = '__claude_cursor';
const CURSOR_SIZE_PX = 16;
const CURSOR_HALF_PX = CURSOR_SIZE_PX / 2;
const RIPPLE_SIZE_PX = 24;
const RIPPLE_HALF_PX = RIPPLE_SIZE_PX / 2;
const RIPPLE_SCALE = 2.5;
const RIPPLE_DURATION_MS = 400;
export function buildCursorEnsureExpression(x, y) {
    const tx = Math.round(x - CURSOR_HALF_PX);
    const ty = Math.round(y - CURSOR_HALF_PX);
    return `(function() {
    if (document.getElementById('${CURSOR_ID}')) return;
    const el = document.createElement('div');
    el.id = '${CURSOR_ID}';
    el.style.cssText = 'position:fixed;top:0;left:0;width:${CURSOR_SIZE_PX}px;height:${CURSOR_SIZE_PX}px;background:rgba(99,102,241,0.95);border:2px solid rgba(255,255,255,0.9);border-radius:50%;pointer-events:none;z-index:2147483647;transform:translate(${tx}px,${ty}px);box-shadow:0 0 0 2px rgba(99,102,241,0.35),0 2px 8px rgba(0,0,0,0.25)';
    (document.body || document.documentElement).appendChild(el);
  })()`;
}
export function buildCursorAnimateExpression(fromX, fromY, toX, toY, durationMs) {
    return `new Promise(resolve => {
    const el = document.getElementById('${CURSOR_ID}');
    if (!el) { resolve(); return; }
    const startTime = performance.now();
    function step(now) {
      const t = Math.min((now - startTime) / ${durationMs}, 1);
      const e = t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
      const x = ${fromX} + (${toX} - ${fromX}) * e;
      const y = ${fromY} + (${toY} - ${fromY}) * e;
      el.style.transform = 'translate(' + (x - ${CURSOR_HALF_PX}) + 'px,' + (y - ${CURSOR_HALF_PX}) + 'px)';
      if (t < 1) requestAnimationFrame(step); else resolve();
    }
    requestAnimationFrame(step);
  })`;
}
export function buildCursorClickRippleExpression(x, y) {
    const tx = Math.round(x - RIPPLE_HALF_PX);
    const ty = Math.round(y - RIPPLE_HALF_PX);
    return `(function() {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;top:0;left:0;width:${RIPPLE_SIZE_PX}px;height:${RIPPLE_SIZE_PX}px;border:2px solid rgba(99,102,241,0.8);border-radius:50%;pointer-events:none;z-index:2147483646;transform:translate(${tx}px,${ty}px) scale(0.3);opacity:1;transition:transform ${RIPPLE_DURATION_MS}ms ease-out,opacity ${RIPPLE_DURATION_MS}ms ease-out';
    (document.body || document.documentElement).appendChild(el);
    requestAnimationFrame(() => {
      el.style.transform = 'translate(${tx}px,${ty}px) scale(${RIPPLE_SCALE})';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), ${RIPPLE_DURATION_MS});
    });
  })()`;
}
