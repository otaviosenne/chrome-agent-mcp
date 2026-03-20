const cursor = document.getElementById('cursor');
const cursorDot = document.getElementById('cursor-dot');
let mouseX = 0, mouseY = 0, cursorX = 0, cursorY = 0;
let isVisible = false;

document.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
  if (!isVisible) {
    cursorX = mouseX;
    cursorY = mouseY;
    isVisible = true;
    cursor.style.opacity = '1';
    cursorDot.style.opacity = '1';
  }
  cursorDot.style.transform = `translate(${mouseX}px, ${mouseY}px)`;
  const spotlight = document.getElementById('spotlight');
  if (spotlight) {
    spotlight.style.background = `radial-gradient(700px circle at ${mouseX}px ${mouseY}px, rgba(108,99,255,0.07), transparent 50%)`;
  }
});

function animateCursor() {
  const dx = mouseX - cursorX;
  const dy = mouseY - cursorY;
  cursorX += dx * 0.12;
  cursorY += dy * 0.12;
  cursor.style.transform = `translate(${cursorX}px, ${cursorY}px)`;
  requestAnimationFrame(animateCursor);
}

animateCursor();

document.addEventListener('mouseleave', () => {
  cursor.style.opacity = '0';
  cursorDot.style.opacity = '0';
  isVisible = false;
});

document.addEventListener('mouseenter', () => {
  cursor.style.opacity = '1';
  cursorDot.style.opacity = '1';
  isVisible = true;
});

document.addEventListener('mousedown', () => cursor.classList.add('cursor-click'));
document.addEventListener('mouseup', () => cursor.classList.remove('cursor-click'));

function bindHoverTargets() {
  document.querySelectorAll('a, button, [data-tilt], .tool-tag, .tool-category').forEach(el => {
    el.addEventListener('mouseenter', () => cursor.classList.add('cursor-hover'));
    el.addEventListener('mouseleave', () => cursor.classList.remove('cursor-hover'));
  });
}

document.addEventListener('DOMContentLoaded', bindHoverTargets);
