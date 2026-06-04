/**
 * Render helpers for the redact plugin's three canvas layers. The
 * approach mirrors the annotate plugin's stacked layers exactly:
 *
 *  - `paintRedactImageLayer` draws the upstream-baked source onto the
 *    bottom canvas. Called once on mount and on stage resize.
 *  - `paintRedactRegionsLayer` draws every committed region's preview
 *    representation on top of the image. Pixelate/blur are baked
 *    into the layer here so the live stage matches the export. Solid
 *    regions are simple coloured rectangles.
 *  - `paintRedactLiveLayer` draws the in-progress region (during a
 *    drag) in display space — a dashed marquee with the current mode
 *    rendered as a translucent fill so the user gets a feel for what
 *    they'll get on commit.
 *
 * The regions layer reuses the core `paintRegion` so the visible
 * preview is byte-equal to the bake output (per region). The image
 * argument is only needed for pixelate/blur — solid doesn't read it.
 */

import {
  type RedactRegion,
  type SourceImage,
  type Viewport,
  paintRedactRegion,
} from '@magicpages/kalotyp-core';

/**
 * Resize the canvas's backing store to stage CSS pixels × DPR and
 * return its 2D context already scaled into CSS-pixel space. Returns
 * `null` if the context is unavailable (jsdom path).
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

export function paintRedactImageLayer(
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
 * Paint every region onto the regions canvas. Pixelate and blur read
 * from the supplied image-source bitmap (drawn at viewport scale) so
 * the preview is the same composition the bake produces. We draw the
 * image into an off-screen canvas at the viewport scale, then ask
 * the core `paintRegion` to redact each region's pixels in turn.
 *
 * The trade-off here: regions drawn during the live preview composite
 * onto the image at *display* pixels (not source pixels), so the
 * pixelate grid size in the preview differs slightly from the export.
 * The bake re-runs at source resolution; the user sees the right
 * thing on the way out.
 */
export function paintRedactRegionsLayer(
  canvas: HTMLCanvasElement,
  source: SourceImage,
  regions: ReadonlyArray<RedactRegion>,
  selectedId: string | null,
  stageWidth: number,
  stageHeight: number,
  viewport: Viewport,
): void {
  const ctx = prepareCanvas(canvas, stageWidth, stageHeight);
  if (!ctx) return;
  if (regions.length === 0) return;

  // Build a temporary canvas the size of the visible image rect that
  // mirrors the source image; `paintRegion` will read pixels from it
  // for pixelate/blur. Drawing into this buffer first means the
  // composite-so-far is the previous regions baked in, which matches
  // the export ordering.
  const tempCanvas = document.createElement('canvas');
  const dispW = Math.max(1, Math.round(viewport.displayRect.width));
  const dispH = Math.max(1, Math.round(viewport.displayRect.height));
  tempCanvas.width = dispW;
  tempCanvas.height = dispH;
  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) return;
  tempCtx.imageSmoothingEnabled = true;
  tempCtx.imageSmoothingQuality = 'high';
  tempCtx.drawImage(source.bitmap, 0, 0, dispW, dispH);

  // Project each region's image-space rect into the temp canvas's
  // display-pixel space and ask the core renderer to paint it.
  for (const region of regions) {
    const projected: RedactRegion = {
      ...region,
      x: region.x * viewport.scale,
      y: region.y * viewport.scale,
      width: region.width * viewport.scale,
      height: region.height * viewport.scale,
    };
    paintRedactRegion(tempCtx, tempCanvas, projected, {
      bitmap: tempCanvas,
      width: dispW,
      height: dispH,
      mimeType: 'image/png',
    });
  }

  // Draw the redacted image preview into the regions canvas at the
  // viewport's display position so it sits exactly over the image
  // layer. Use destination-over composite so a future overlay on
  // the same canvas wouldn't swallow earlier paints, though we
  // currently only paint regions here.
  ctx.drawImage(tempCanvas, viewport.displayRect.x, viewport.displayRect.y, dispW, dispH);

  // Draw a thin outline around every region so the user can see
  // where the redaction sits. The selected region gets a brighter
  // accent stroke (the selection-handle layer adds the corner
  // handles on top of this).
  for (const region of regions) {
    const x = viewport.displayRect.x + region.x * viewport.scale;
    const y = viewport.displayRect.y + region.y * viewport.scale;
    const w = region.width * viewport.scale;
    const h = region.height * viewport.scale;
    ctx.save();
    if (region.id === selectedId) {
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.9)';
      ctx.lineWidth = 1.5;
    } else {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1;
    }
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, h - 1));
    ctx.restore();
  }
}

/**
 * Draw a marquee for the in-progress drag. We don't bake pixelate /
 * blur here — pixelate at the live drag's pixel grid is jittery and
 * doesn't help the user understand the result. Instead we paint a
 * translucent fill in the mode's signature colour:
 *
 *  - `solid` → user-chosen colour at 70% alpha
 *  - `pixelate` → neutral grey at 60% alpha + a "pixelate" texture
 *    (a small grid of squares) so the user knows what they're getting
 *  - `blur` → low-alpha blue-grey, signalling "softening" without
 *    actually blurring (we'd have to repeatedly re-read the canvas;
 *    the export bake handles the real blur).
 */
export function paintRedactLiveLayer(
  canvas: HTMLCanvasElement,
  marquee: {
    x: number;
    y: number;
    width: number;
    height: number;
    mode: RedactRegion['mode'];
    color: string;
  } | null,
  stageWidth: number,
  stageHeight: number,
  viewport: Viewport,
): void {
  const ctx = prepareCanvas(canvas, stageWidth, stageHeight);
  if (!ctx) return;
  if (!marquee) return;

  const dx = viewport.displayRect.x + marquee.x * viewport.scale;
  const dy = viewport.displayRect.y + marquee.y * viewport.scale;
  let dw = marquee.width * viewport.scale;
  let dh = marquee.height * viewport.scale;
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
  ctx.fillStyle = marqueeFillFor(marquee.mode, marquee.color);
  ctx.fillRect(drawX, drawY, dw, dh);
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.95)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(drawX + 0.75, drawY + 0.75, Math.max(0, dw - 1.5), Math.max(0, dh - 1.5));
  ctx.restore();
}

function marqueeFillFor(mode: RedactRegion['mode'], color: string): string {
  switch (mode) {
    case 'solid':
      return hexWithAlpha(color, 0.7);
    case 'pixelate':
      return 'rgba(120, 120, 120, 0.6)';
    case 'blur':
      return 'rgba(180, 200, 220, 0.45)';
  }
}

/**
 * Build an `rgba(...)` string from a `#rrggbb` hex and an alpha. Falls
 * back to the input string if the hex doesn't parse (e.g. a CSS
 * keyword) so the live preview still draws something.
 */
function hexWithAlpha(hex: string, alpha: number): string {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!match) return hex;
  const value = match[1];
  if (!value) return hex;
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
