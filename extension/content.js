let port = null;

const commandQueue = [];
let processingQueue = false;

async function processNextCommand() {
  if (processingQueue || commandQueue.length === 0) return;
  processingQueue = true;
  const command = commandQueue.shift();
  try {
    await command();
  } finally {
    processingQueue = false;
    processNextCommand();
  }
}

function enqueueCommand(fn) {
  commandQueue.push(fn);
  processNextCommand();
}

chrome.runtime.onMessage.addListener((message) => {
  enqueueCommand(async () => {
    if (message.type === "rename") {
      document.title = message.value;
    } else if (message.type === "color") {
      document.documentElement.style.setProperty("--session-color", message.value);
    }
  });
  return true;
});

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
