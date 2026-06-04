import { createBakeCanvas, getBakeContext2D } from '../../canvas/bake-canvas.js';
import type { SourceImage } from '../utility.js';
import type { RedactRegion } from './state.js';

export interface RedactBakeInput {
  readonly regions: ReadonlyArray<RedactRegion>;
}

/** Paint every redaction region onto a copy of `source` in creation order. */
export async function bakeRedact(
  state: RedactBakeInput,
  source: SourceImage,
): Promise<SourceImage> {
  if (state.regions.length === 0) return source;

  const bake = createBakeCanvas(source.width, source.height);
  const ctx = getBakeContext2D(bake);

  ctx.drawImage(source.bitmap, 0, 0, source.width, source.height);

  // Pixelate/blur read from the post-source canvas, so overlapping
  // earlier regions are redacted again — "redact wins".
  for (const region of state.regions) {
    paintRegion(ctx, bake.canvas, region, source);
  }

  return {
    bitmap: bake.canvas,
    width: source.width,
    height: source.height,
    mimeType: source.mimeType,
  };
}

/**
 * Paint a single redaction region. `canvas` is needed because pixelate
 * and blur read from it and redraw a transformed copy in place.
 */
export function paintRegion(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  canvas: HTMLCanvasElement | OffscreenCanvas,
  region: RedactRegion,
  source: SourceImage,
): void {
  // Degenerate rects would crash `getImageData` on some engines.
  const w = Math.round(region.width);
  const h = Math.round(region.height);
  if (w < 1 || h < 1) return;
  const x = Math.round(region.x);
  const y = Math.round(region.y);

  switch (region.mode) {
    case 'solid':
      paintSolid(ctx, region, x, y, w, h);
      return;
    case 'pixelate':
      paintPixelate(ctx, canvas, source, x, y, w, h);
      return;
    case 'blur':
      paintBlur(ctx, canvas, source, x, y, w, h);
      return;
  }
}

function paintSolid(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  region: RedactRegion,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.save();
  ctx.fillStyle = region.color;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

/**
 * Pixelate by downsampling to a small grid then upsampling with
 * nearest-neighbour. Capped at 8 cells on the longer side; floored at
 * 4 so tiny regions still read as chunky rather than as anti-aliasing.
 */
function paintPixelate(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  canvas: HTMLCanvasElement | OffscreenCanvas,
  _source: SourceImage,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const longer = Math.max(w, h);
  const cells = Math.max(4, Math.round(8 * Math.min(1, longer / 240)));
  const gridW = Math.max(1, Math.round((w / longer) * cells));
  const gridH = Math.max(1, Math.round((h / longer) * cells));

  ctx.save();
  const small = createSmallCanvas(gridW, gridH);
  if (!small) {
    ctx.restore();
    return;
  }
  small.ctx.imageSmoothingEnabled = true;
  small.ctx.imageSmoothingQuality = 'low';
  small.ctx.drawImage(canvas, x, y, w, h, 0, 0, gridW, gridH);

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(small.canvas, 0, 0, gridW, gridH, x, y, w, h);
  ctx.restore();
}

/** Downscale-and-back blur. Two passes (1/8 then 1/2) approximate a Gaussian. */
function paintBlur(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  canvas: HTMLCanvasElement | OffscreenCanvas,
  _source: SourceImage,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const downscale = 1 / 8;
  const smallW = Math.max(1, Math.round(w * downscale));
  const smallH = Math.max(1, Math.round(h * downscale));

  const small = createSmallCanvas(smallW, smallH);
  if (!small) return;
  small.ctx.imageSmoothingEnabled = true;
  small.ctx.imageSmoothingQuality = 'high';
  small.ctx.drawImage(canvas, x, y, w, h, 0, 0, smallW, smallH);

  const tinyW = Math.max(1, Math.round(smallW * 0.5));
  const tinyH = Math.max(1, Math.round(smallH * 0.5));
  const tiny = createSmallCanvas(tinyW, tinyH);
  if (!tiny) {
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(small.canvas, 0, 0, smallW, smallH, x, y, w, h);
    ctx.restore();
    return;
  }
  tiny.ctx.imageSmoothingEnabled = true;
  tiny.ctx.imageSmoothingQuality = 'high';
  tiny.ctx.drawImage(small.canvas, 0, 0, smallW, smallH, 0, 0, tinyW, tinyH);

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(tiny.canvas, 0, 0, tinyW, tinyH, x, y, w, h);
  ctx.restore();
}

interface SmallCanvas {
  readonly canvas: HTMLCanvasElement | OffscreenCanvas;
  readonly ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
}

/** Small intermediate canvas; prefers OffscreenCanvas, falls back to detached `<canvas>`. */
function createSmallCanvas(width: number, height: number): SmallCanvas | null {
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      const offscreen = new OffscreenCanvas(width, height);
      const ctx = offscreen.getContext('2d');
      if (ctx) return { canvas: offscreen, ctx };
    } catch {
      // Some engines throw on zero-size construction.
    }
  }
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  return { canvas, ctx };
}
