/**
 * Badge and action updates
 * Manages extension icon badge, animation, and title
 */

const ICON_SIZES = [16, 32] as const;
type IconSize = (typeof ICON_SIZES)[number];

const FRAME_COUNT = 12;
const FRAME_INTERVAL = 120;

type FrameSet = Record<IconSize, ImageData>;

let animationTimer: number | null = null;
let frameIndex = 0;
let frameCache: FrameSet[] | null = null;

/**
 * Update badge with progress percentage
 */
export function updateBadge(progress: number): void {
  const text = progress > 0 && progress < 100 ? `${progress}%` : "";

  chrome.action.setBadgeText({ text });

  if (progress > 0 && progress < 100) {
    chrome.action.setBadgeBackgroundColor({ color: "#4CAF50" }); // Green
  } else if (progress === 100) {
    chrome.action.setBadgeBackgroundColor({ color: "#2196F3" }); // Blue
  }
}

/**
 * Clear badge
 */
export function clearBadge(): void {
  chrome.action.setBadgeText({ text: "" });
}

/**
 * Set action title
 */
export function setActionTitle(title: string): void {
  chrome.action.setTitle({ title });
}

/**
 * Start animated extension icon while tasks are active
 */
export async function startIconAnimation(): Promise<void> {
  if (animationTimer !== null) return;

  const frames = await generateFrames();

  if (!frames.length) return;

  frameIndex = 0;
  // Render first frame immediately so the icon updates without waiting for the timer
  void chrome.action.setIcon({ imageData: toImageDataDict(frames[frameIndex]) });
  frameIndex = (frameIndex + 1) % frames.length;

  animationTimer = self.setInterval(() => {
    const frame = frames[frameIndex];
    frameIndex = (frameIndex + 1) % frames.length;
    void chrome.action.setIcon({ imageData: toImageDataDict(frame) });
  }, FRAME_INTERVAL);
}

/**
 * Stop icon animation and reset to default asset
 */
export function stopIconAnimation(): void {
  if (animationTimer !== null) {
    self.clearInterval(animationTimer);
    animationTimer = null;
  }

  void chrome.action.setIcon({
    path: {
      32: "icons/32_download.png",
    },
  });
  frameIndex = 0;
}

async function generateFrames(): Promise<FrameSet[]> {
  if (frameCache) return frameCache;

  if (typeof OffscreenCanvas === "undefined") {
    console.warn("[QuickGet] Icon animation using fallback frames (OffscreenCanvas unavailable)");
    frameCache = createFallbackFrames();
    return frameCache;
  }

  try {
    frameCache = createCanvasFrames();
    return frameCache;
  } catch (error) {
    console.warn("[QuickGet] Icon animation falling back after canvas error:", error);
    frameCache = createFallbackFrames();
    return frameCache;
  }
}

type IconImageDict = Record<number, ImageData>;

function toImageDataDict(frame: FrameSet): IconImageDict {
  const imageData: IconImageDict = {};
  for (const size of ICON_SIZES) {
    imageData[size] = frame[size];
  }
  return imageData;
}

function createFrameSet(phase: number, total: number): FrameSet {
  const frame = {} as FrameSet;
  for (const size of ICON_SIZES) {
    frame[size] = renderFrame(size, phase, total);
  }
  return frame;
}

function renderFrame(size: IconSize, phase: number, total: number): ImageData {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Failed to acquire 2D context for icon animation");
  }

  const unit = size / 32;

  drawBackground(ctx, size, unit);

  const theta = (phase / total) * Math.PI * 2;
  const arrowOffset = Math.sin(theta) * unit * 2.2; // gentle up/down motion

  drawArrow(ctx, size, unit, arrowOffset);
  drawBaseline(ctx, size, unit, theta);
  drawSpinner(ctx, size, unit, theta);

  return ctx.getImageData(0, 0, size, size);
}

function createCanvasFrames(): FrameSet[] {
  const frames: FrameSet[] = [];
  for (let i = 0; i < FRAME_COUNT; i += 1) {
    frames.push(createFrameSet(i, FRAME_COUNT));
  }
  return frames;
}

function drawBackground(
  ctx: OffscreenCanvasRenderingContext2D,
  size: number,
  unit: number
): void {
  const radius = 6 * unit;
  const gradient = ctx.createLinearGradient(0, 0, 0, size);
  gradient.addColorStop(0, "#38c3ff");
  gradient.addColorStop(1, "#0ea5e9");

  ctx.fillStyle = gradient;
  drawRoundedRect(ctx, unit, unit, size - unit * 2, size - unit * 2, radius);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 0.9 * unit;
  drawRoundedRect(ctx, unit * 1.5, unit * 1.5, size - unit * 3, size - unit * 3, radius);
  ctx.stroke();

  // Subtle top highlight
  const highlight = ctx.createLinearGradient(0, 0, 0, size / 2);
  highlight.addColorStop(0, "rgba(255, 255, 255, 0.45)");
  highlight.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = highlight;
  drawRoundedRect(ctx, unit * 2, unit * 2, size - unit * 4, size / 2, radius - unit);
  ctx.fill();
}

function drawArrow(
  ctx: OffscreenCanvasRenderingContext2D,
  size: number,
  unit: number,
  offsetY: number
): void {
  ctx.fillStyle = "#ffffff";

  const centerX = size / 2;
  const shaftWidth = 4 * unit;
  const shaftHeight = 10 * unit;
  const shaftX = centerX - shaftWidth / 2;
  const shaftY = 8 * unit + offsetY;

  ctx.fillRect(shaftX, shaftY, shaftWidth, shaftHeight);

  ctx.beginPath();
  ctx.moveTo(centerX, shaftY + shaftHeight + 7 * unit);
  ctx.lineTo(centerX - 6 * unit, shaftY + shaftHeight - unit);
  ctx.lineTo(centerX + 6 * unit, shaftY + shaftHeight - unit);
  ctx.closePath();
  ctx.fill();
}

function drawBaseline(
  ctx: OffscreenCanvasRenderingContext2D,
  size: number,
  unit: number,
  theta: number
): void {
  const barY = size - 7 * unit;
  const barHeight = 3 * unit;
  const inset = 8 * unit;
  const usableWidth = size - inset * 2;

  ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
  ctx.fillRect(inset, barY, usableWidth, barHeight);

  const pulseWidth = 10 * unit;
  const travel = usableWidth - pulseWidth;
  const offset = inset + travel * ((Math.sin(theta) + 1) / 2);

  ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
  ctx.fillRect(offset, barY, pulseWidth, barHeight);
}

function drawSpinner(
  ctx: OffscreenCanvasRenderingContext2D,
  size: number,
  unit: number,
  theta: number
): void {
  const center = size / 2;
  const radius = size * 0.36;
  const sweep = Math.PI * 1.4;
  const startAngle = theta;
  const endAngle = startAngle + sweep;

  ctx.save();
  ctx.globalAlpha = 0.65;
  ctx.lineWidth = 3 * unit;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(center, center, radius, startAngle, endAngle);
  ctx.stroke();
  ctx.restore();
}

function createFallbackFrames(): FrameSet[] {
  const palettes: Array<{ background: [number, number, number]; accent: [number, number, number] }> =
    [
      { background: [14, 165, 233], accent: [255, 255, 255] },
      { background: [249, 115, 22], accent: [30, 64, 175] },
    ];

  return palettes.map((palette) => createSolidFrameSet(palette.background, palette.accent));
}

function createSolidFrameSet(
  background: [number, number, number],
  accent: [number, number, number]
): FrameSet {
  const frame = {} as FrameSet;

  for (const size of ICON_SIZES) {
    frame[size] = createSolidFrame(size, background, accent);
  }

  return frame;
}

function drawRoundedRect(
  ctx: OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const r = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function createSolidFrame(
  size: IconSize,
  background: [number, number, number],
  accent: [number, number, number]
): ImageData {
  const data = new Uint8ClampedArray(size * size * 4);

  for (let i = 0; i < size * size; i += 1) {
    const baseIndex = i * 4;
    data[baseIndex] = background[0];
    data[baseIndex + 1] = background[1];
    data[baseIndex + 2] = background[2];
    data[baseIndex + 3] = 255;
  }

  // Simple accent square in the center to mimic an arrow block
  const inset = Math.floor(size * 0.25);
  for (let y = inset; y < size - inset; y += 1) {
    for (let x = inset; x < size - inset; x += 1) {
      const index = (y * size + x) * 4;
      data[index] = accent[0];
      data[index + 1] = accent[1];
      data[index + 2] = accent[2];
      data[index + 3] = 255;
    }
  }

  return new ImageData(data, size, size);
}
