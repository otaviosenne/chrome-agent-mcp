let port = null;

function connect() {
  port = chrome.runtime.connect({ name: 'keepAlive' });
  port.onDisconnect.addListener(() => setTimeout(connect, 1000));
}

function ping() {
  try { port?.postMessage('ping'); } catch {}
  setTimeout(ping, 20000);
}

connect();
ping();
