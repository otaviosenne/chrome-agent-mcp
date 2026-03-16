function drawRobotFrame(squinting, size) {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const s = size / 32;

  ctx.fillStyle = "white";
  ctx.fillRect(2*s, 1*s, 28*s, 20*s);
  ctx.fillRect(2*s, 20*s, 10*s, 11*s);
  ctx.fillRect(20*s, 20*s, 10*s, 11*s);
  ctx.fillStyle = "#C87850";
  ctx.fillRect(4*s, 3*s, 24*s, 17*s);
  ctx.fillRect(4*s, 20*s, 8*s, 9*s);
  ctx.fillRect(20*s, 20*s, 8*s, 9*s);
  ctx.fillStyle = "#1a1a1a";

  if (!squinting) {
    ctx.fillRect(8*s, 9*s, 4*s, 4*s);
    ctx.fillRect(20*s, 9*s, 4*s, 4*s);
  } else {
    ctx.lineWidth = 2.5 * s;
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(7*s, 8*s); ctx.lineTo(13*s, 11*s); ctx.lineTo(7*s, 14*s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(25*s, 8*s); ctx.lineTo(19*s, 11*s); ctx.lineTo(25*s, 14*s);
    ctx.stroke();
  }

  return ctx.getImageData(0, 0, size, size);
}

export async function setRobotIcon(squinting) {
  try {
    const imageData = drawRobotFrame(squinting, 32);
    await chrome.action.setIcon({ imageData: { 32: imageData } });
  } catch {}
}

let iconAnimInterval = null;
let iconFrame = 0;

export function startIconAnimation() {
  if (iconAnimInterval) return;
  iconFrame = 0;
  iconAnimInterval = setInterval(() => {
    setRobotIcon(iconFrame % 2 === 1);
    iconFrame++;
  }, 250);
}

export function stopIconAnimation() {
  if (iconAnimInterval) {
    clearInterval(iconAnimInterval);
    iconAnimInterval = null;
  }
  setRobotIcon(false);
}
