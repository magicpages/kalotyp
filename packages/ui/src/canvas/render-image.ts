import type { Viewport } from '@magicpages/kalotyp-core';

/** Paint the source image onto the canvas at the viewport's display size, DPR-scaled. */
export function renderImageCanvas(
  canvas: HTMLCanvasElement,
  source: CanvasImageSource,
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
  ctx.drawImage(
    source,
    viewport.displayRect.x,
    viewport.displayRect.y,
    viewport.displayRect.width,
    viewport.displayRect.height,
  );
}
