import { type Rect, type Viewport, rectImageToDisplay } from '@magicpages/kalotyp-core';

const MASK_FILL = 'rgba(0, 0, 0, 0.4)';
// Halo pattern (wide soft-black under, 1px white over) stays readable on any background
// without `mix-blend-mode: difference`, which has known Safari bugs over canvas.
const OUTLINE_HALO = 'rgba(0, 0, 0, 0.45)';
const OUTLINE_HALO_WIDTH = 3;
const OUTLINE_STROKE = 'rgba(255, 255, 255, 0.95)';
const OUTLINE_WIDTH = 1;
const GRID_HALO = 'rgba(0, 0, 0, 0.25)';
const GRID_HALO_WIDTH = 2;
const GRID_STROKE = 'rgba(255, 255, 255, 0.55)';
const GRID_WIDTH = 1;

/** Repaint the overlay: dim mask outside the crop rect, outline, and rule-of-thirds grid. */
export function renderOverlayCanvas(
  canvas: HTMLCanvasElement,
  cropRectImage: Rect,
  stageWidth: number,
  stageHeight: number,
  viewport: Viewport,
): void {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const targetW = Math.max(1, Math.round(stageWidth * dpr));
  const targetH = Math.max(1, Math.round(stageHeight * dpr));
  if (canvas.width !== targetW) canvas.width = targetW;
  if (canvas.height !== targetH) canvas.height = targetH;
  canvas.style.width = `${stageWidth}px`;
  canvas.style.height = `${stageHeight}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, stageWidth, stageHeight);

  const display = rectImageToDisplay(cropRectImage, viewport);
  const imageRect = viewport.displayRect;

  // Mask is scoped to the image's display rect, not the whole stage — the editor mat
  // outside the image stays clean.
  ctx.save();
  ctx.fillStyle = MASK_FILL;
  ctx.fillRect(imageRect.x, imageRect.y, imageRect.width, imageRect.height);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillRect(display.x, display.y, display.width, display.height);
  ctx.restore();

  const x = display.x + 0.5;
  const y = display.y + 0.5;
  const w = display.width - 1;
  const h = display.height - 1;
  ctx.strokeStyle = OUTLINE_HALO;
  ctx.lineWidth = OUTLINE_HALO_WIDTH;
  ctx.strokeRect(x, y, w, h);
  ctx.strokeStyle = OUTLINE_STROKE;
  ctx.lineWidth = OUTLINE_WIDTH;
  ctx.strokeRect(x, y, w, h);

  drawGridLines(ctx, display, GRID_HALO, GRID_HALO_WIDTH);
  drawGridLines(ctx, display, GRID_STROKE, GRID_WIDTH);
  // Corner visuals are owned by DOM buttons (see build-stage.ts); don't double-draw here.
}

function drawGridLines(
  ctx: CanvasRenderingContext2D,
  display: Rect,
  stroke: string,
  width: number,
): void {
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.beginPath();
  for (let i = 1; i < 3; i++) {
    const x = display.x + (display.width * i) / 3;
    const y = display.y + (display.height * i) / 3;
    ctx.moveTo(x, display.y);
    ctx.lineTo(x, display.y + display.height);
    ctx.moveTo(display.x, y);
    ctx.lineTo(display.x + display.width, y);
  }
  ctx.stroke();
}
