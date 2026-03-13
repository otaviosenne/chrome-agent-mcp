// Keeps the service worker alive — reconnects if it dies
function connect() {
  const port = chrome.runtime.connect({ name: 'keepAlive' });
  port.onDisconnect.addListener(() => setTimeout(connect, 1000));
}
connect();
