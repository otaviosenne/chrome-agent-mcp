const CURSOR_ID = '__claude_cursor';
const CURSOR_SIZE_PX = 16;
const CURSOR_HALF_PX = CURSOR_SIZE_PX / 2;
const RIPPLE_SIZE_PX = 24;
const RIPPLE_HALF_PX = RIPPLE_SIZE_PX / 2;
const RIPPLE_SCALE = 2.5;
const RIPPLE_DURATION_MS = 400;
const SCROLL_PULSE_DURATION_MS = 500;
const SCROLL_PULSE_FLOAT_PX = 32;
const SCROLL_DIRECTION_SYMBOLS = {
    down: '↓',
    up: '↑',
    right: '→',
    left: '←',
};
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
export function buildCursorScrollPulseExpression(direction) {
    const symbol = SCROLL_DIRECTION_SYMBOLS[direction] ?? '↕';
    const isVertical = direction === 'down' || direction === 'up';
    const floatDy = direction === 'down' ? SCROLL_PULSE_FLOAT_PX : direction === 'up' ? -SCROLL_PULSE_FLOAT_PX : 0;
    const floatDx = direction === 'right' ? SCROLL_PULSE_FLOAT_PX : direction === 'left' ? -SCROLL_PULSE_FLOAT_PX : 0;
    return `(function() {
    const cursor = document.getElementById('${CURSOR_ID}');
    if (!cursor) return;
    const match = cursor.style.transform.match(/translate\\(([\\d.-]+)px,([\\d.-]+)px\\)/);
    if (!match) return;
    const cx = parseFloat(match[1]) + ${CURSOR_HALF_PX};
    const cy = parseFloat(match[2]) + ${CURSOR_HALF_PX};
    for (let i = 0; i < 3; i++) {
      const el = document.createElement('div');
      const delay = i * 80;
      el.style.cssText = 'position:fixed;top:0;left:0;font-size:14px;font-weight:700;color:rgba(99,102,241,0.9);pointer-events:none;z-index:2147483646;transform:translate(' + (cx - 7) + 'px,' + (cy - 7) + 'px);opacity:0;text-shadow:0 1px 4px rgba(0,0,0,0.5);transition:none';
      el.textContent = '${symbol}';
      (document.body || document.documentElement).appendChild(el);
      setTimeout(() => {
        el.style.transition = 'transform ${SCROLL_PULSE_DURATION_MS}ms ease-out,opacity ${SCROLL_PULSE_DURATION_MS}ms ease-out';
        el.style.transform = 'translate(' + (cx - 7 + ${floatDx}) + 'px,' + (cy - 7 + ${floatDy}) + 'px)';
        el.style.opacity = '1';
        setTimeout(() => {
          el.style.opacity = '0';
          setTimeout(() => el.remove(), ${SCROLL_PULSE_DURATION_MS});
        }, ${SCROLL_PULSE_DURATION_MS} / 2);
      }, delay);
    }
  })()`;
}
export function buildCursorClickRippleExpression(x, y) {
    const tx = Math.round(x - RIPPLE_HALF_PX);
    const ty = Math.round(y - RIPPLE_HALF_PX);
    const cursorTx = Math.round(x - CURSOR_HALF_PX);
    const cursorTy = Math.round(y - CURSOR_HALF_PX);
    return `(function() {
    const ripple = document.createElement('div');
    ripple.style.cssText = 'position:fixed;top:0;left:0;width:${RIPPLE_SIZE_PX}px;height:${RIPPLE_SIZE_PX}px;border:2px solid rgba(99,102,241,0.8);border-radius:50%;pointer-events:none;z-index:2147483646;transform:translate(${tx}px,${ty}px) scale(0.3);opacity:1;transition:transform ${RIPPLE_DURATION_MS}ms ease-out,opacity ${RIPPLE_DURATION_MS}ms ease-out';
    (document.body || document.documentElement).appendChild(ripple);
    const cursor = document.getElementById('${CURSOR_ID}');
    if (cursor) {
      cursor.style.transition = 'transform 80ms ease-out,background 80ms ease-out';
      cursor.style.background = 'rgba(139,92,246,1)';
      cursor.style.transform = 'translate(${cursorTx}px,${cursorTy}px) scale(0.6)';
      setTimeout(() => {
        cursor.style.transform = 'translate(${cursorTx}px,${cursorTy}px) scale(1)';
        cursor.style.background = 'rgba(99,102,241,0.95)';
        setTimeout(() => { cursor.style.transition = 'none'; }, 120);
      }, 80);
    }
    requestAnimationFrame(() => {
      ripple.style.transform = 'translate(${tx}px,${ty}px) scale(${RIPPLE_SCALE})';
      ripple.style.opacity = '0';
      setTimeout(() => ripple.remove(), ${RIPPLE_DURATION_MS});
    });
  })()`;
}
