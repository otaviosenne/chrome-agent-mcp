import { ChromeConnection } from "./connection.js";


const START_SCRIPT = `
(function() {
  if (window.__cf) return;
  window.__cf = true;

  var allLinks = document.querySelectorAll('link[rel~="icon"]');
  window.__cfOriginals = Array.from(allLinks).map(function(l) {
    return { rel: l.rel, type: l.getAttribute('type'), href: l.href, sizes: l.getAttribute('sizes') };
  });
  allLinks.forEach(function(l) { l.parentNode && l.parentNode.removeChild(l); });

  var c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  var x = c.getContext('2d');
  if (!x) { window.__cf = false; return; }

  var link = document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/png';
  document.head.appendChild(link);
  window.__cfLink = link;

  window.__cfCurrent = null;

  function draw(squinting) {
    x.clearRect(0, 0, 32, 32);
    x.fillStyle = 'white';
    x.fillRect(2, 1, 28, 20);
    x.fillRect(2, 20, 10, 11);
    x.fillRect(20, 20, 10, 11);
    x.fillStyle = '#C87850';
    x.fillRect(4, 3, 24, 17);
    x.fillRect(4, 20, 8, 9);
    x.fillRect(20, 20, 8, 9);
    x.fillStyle = '#1a1a1a';
    if (!squinting) {
      x.fillRect(8, 9, 4, 4);
      x.fillRect(20, 9, 4, 4);
    } else {
      x.lineWidth = 2.5;
      x.strokeStyle = '#1a1a1a';
      x.lineCap = 'round';
      x.lineJoin = 'round';
      x.beginPath();
      x.moveTo(7, 8); x.lineTo(13, 11); x.lineTo(7, 14);
      x.stroke();
      x.beginPath();
      x.moveTo(25, 8); x.lineTo(19, 11); x.lineTo(25, 14);
      x.stroke();
    }
    window.__cfCurrent = c.toDataURL('image/png');
    link.href = window.__cfCurrent;
  }

  var headObserver = new MutationObserver(function(mutations) {
    if (!window.__cf) return;
    mutations.forEach(function(m) {
      m.addedNodes.forEach(function(node) {
        if (node.nodeName === 'LINK' && node !== link) {
          var rel = node.getAttribute('rel') || '';
          if (rel.indexOf('icon') !== -1) {
            node.parentNode && node.parentNode.removeChild(node);
          }
        }
      });
    });
  });
  headObserver.observe(document.head, { childList: true });
  window.__cfHeadObserver = headObserver;

  var frame = 0;
  window.__cfInterval = setInterval(function() {
    draw(frame % 2 === 1);
    frame++;
  }, 250);
})();
`;

const STOP_SCRIPT = `
(function() {
  if (!window.__cf) return;
  window.__cf = false;
  clearInterval(window.__cfInterval);
  if (window.__cfHeadObserver) window.__cfHeadObserver.disconnect();
  window.__cfCurrent = null;
  var link = window.__cfLink;
  if (link && link.parentNode) link.parentNode.removeChild(link);
  var originals = window.__cfOriginals || [];
  originals.forEach(function(o) {
    var l = document.createElement('link');
    l.rel = o.rel;
    if (o.type) l.type = o.type;
    if (o.sizes) l.setAttribute('sizes', o.sizes);
    l.href = o.href;
    document.head.appendChild(l);
  });
})();
`;

export class TabFaviconManager {
  private readonly abortedTabs = new Set<string>();

  async startActivity(tabId: string, connection: ChromeConnection): Promise<void> {
    this.abortedTabs.delete(tabId);
    try {
      const client = await connection.getClientForTab(tabId);
      await client.Runtime.evaluate({ expression: START_SCRIPT });
    } catch {}
  }

  async startActivityAfterLoad(tabId: string, connection: ChromeConnection): Promise<void> {
    this.abortedTabs.delete(tabId);
    try {
      const client = await connection.getClientForTab(tabId);
      await client.Runtime.evaluate({ expression: START_SCRIPT });
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, 8000);
        client.Page.domContentEventFired(() => {
          clearTimeout(timeout);
          resolve();
        });
      });
      if (this.abortedTabs.has(tabId)) return;
      await client.Runtime.evaluate({ expression: START_SCRIPT });
    } catch {}
  }

  async markDone(tabId: string, connection: ChromeConnection): Promise<void> {
    this.abortedTabs.add(tabId);
    await this.stopActivity(tabId, connection);
  }

  async stopActivity(tabId: string, connection: ChromeConnection): Promise<void> {
    try {
      const client = await connection.getClientForTab(tabId);
      await client.Runtime.evaluate({ expression: STOP_SCRIPT });
    } catch {}
  }
}
