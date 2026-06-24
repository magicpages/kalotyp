/**
 * Render helpers for the annotation plugin's three canvas layers.
 *
 *  - `paintImageLayer`: paints the upstream-baked source onto the
 *    bottom canvas. Called once on mount and on stage resize.
 *  - `paintShapesLayer`: paints every committed shape onto the middle
 *    canvas. Called when the shape list, selection, or viewport
 *    changes.
 *  - `paintLiveLayer`: paints whatever the in-progress gesture wants
 *    on top — a draft shape during a drag, a marquee, etc. Called
 *    per frame during a gesture.
 *
 * All three reuse the same DPR-aware canvas-sizing helper to keep the
 * pixel grids consistent. Shapes are rendered through `paintShape`
 * from the core `bake.ts` module so the live preview is byte-equal to
 * the bake output (per shape).
 */

import {
  type PaintShapeOptions,
  paintShape,
  type Shape,
  type SourceImage,
  type Viewport,
} from '@magicpages/kalotyp-core';

/**
 * Resize the canvas's backing store to the stage CSS pixels × DPR
 * and return its 2D context already scaled into CSS-pixel space.
 * Returns `null` if the context is unavailable (jsdom path).
 */
function prepareCanvas(
  canvas: HTMLCanvasElement,
  stageWidth: number,
  stageHeight: number,
): CanvasRenderingContext2D | null {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const targetW = Math.max(1, Math.round(stageWidth * dpr));
  const targetH = Math.max(1, Math.round(stageHeight * dpr));
  if (canvas.width !== targetW) canvas.width = targetW;
  if (canvas.height !== targetH) canvas.height = targetH;
  canvas.style.width = `${stageWidth}px`;
  canvas.style.height = `${stageHeight}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, stageWidth, stageHeight);
  return ctx;
}

export function paintImageLayer(
  canvas: HTMLCanvasElement,
  source: SourceImage,
  stageWidth: number,
  stageHeight: number,
  viewport: Viewport,
): void {
  const ctx = prepareCanvas(canvas, stageWidth, stageHeight);
  if (!ctx) return;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    source.bitmap,
    viewport.displayRect.x,
    viewport.displayRect.y,
    viewport.displayRect.width,
    viewport.displayRect.height,
  );
}

/**
 * Paint a list of shapes by setting up an image-space coordinate
 * frame and calling the shared `paintShape` for each. The image-space
 * frame is established by translating to the displayRect's origin and
 * scaling by the viewport scale; the shapes' image-space coordinates
 * then land at the right display pixels for free.
 */
export function paintShapesLayer(
  canvas: HTMLCanvasElement,
  shapes: ReadonlyArray<Shape>,
  stageWidth: number,
  stageHeight: number,
  viewport: Viewport,
  opts?: PaintShapeOptions,
): void {
  const ctx = prepareCanvas(canvas, stageWidth, stageHeight);
  if (!ctx) return;
  if (shapes.length === 0) return;
  ctx.save();
  ctx.translate(viewport.displayRect.x, viewport.displayRect.y);
  ctx.scale(viewport.scale, viewport.scale);
  for (const shape of shapes) {
    paintShape(ctx, shape, opts);
  }
  ctx.restore();
}

/**
 * Paint a single in-progress shape on the live canvas. Same
 * coordinate setup as the shapes layer; passing `null` clears the
 * canvas without drawing — useful when a gesture ends.
 */
export function paintLiveLayer(
  canvas: HTMLCanvasElement,
  shape: Shape | null,
  stageWidth: number,
  stageHeight: number,
  viewport: Viewport,
  opts?: PaintShapeOptions,
): void {
  const ctx = prepareCanvas(canvas, stageWidth, stageHeight);
  if (!ctx) return;
  if (shape === null) return;
  ctx.save();
  ctx.translate(viewport.displayRect.x, viewport.displayRect.y);
  ctx.scale(viewport.scale, viewport.scale);
  paintShape(ctx, shape, opts);
  ctx.restore();
}

/**
 * Paint a selection-marquee rectangle (image-space) on the live
 * canvas. Distinct from `paintLiveLayer` because the marquee uses
 * dashed strokes + a faint fill — visual conventions for "I am
 * marquee-selecting" — that don't belong to any committed shape.
 */
export function paintMarqueeLayer(
  canvas: HTMLCanvasElement,
  marqueeImage: { x: number; y: number; width: number; height: number } | null,
  stageWidth: number,
  stageHeight: number,
  viewport: Viewport,
): void {
  const ctx = prepareCanvas(canvas, stageWidth, stageHeight);
  if (!ctx) return;
  if (!marqueeImage) return;
  // Translate to display space (no scale — drawing in display pixels
  // so the dash pattern stays a constant visual width regardless of
  // the upstream image's pixel density).
  const dx = viewport.displayRect.x + marqueeImage.x * viewport.scale;
  const dy = viewport.displayRect.y + marqueeImage.y * viewport.scale;
  let dw = marqueeImage.width * viewport.scale;
  let dh = marqueeImage.height * viewport.scale;
  // Negative-extent drag: flip the box for rendering so we always
  // pass non-negative dimensions to fillRect/strokeRect.
  let drawX = dx;
  let drawY = dy;
  if (dw < 0) {
    drawX = dx + dw;
    dw = -dw;
  }
  if (dh < 0) {
    drawY = dy + dh;
    dh = -dh;
  }
  ctx.save();
  ctx.fillStyle = 'rgba(99, 102, 241, 0.12)';
  ctx.fillRect(drawX, drawY, dw, dh);
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.95)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(drawX + 0.5, drawY + 0.5, dw - 1, dh - 1);
  ctx.restore();
}
