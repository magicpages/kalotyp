import { createBakeCanvas } from '../../canvas/bake-canvas.js';
import { type Rect, roundRect } from '../../geometry/rect.js';
import type { SourceImage } from '../utility.js';

export interface CropBakeInput {
  /** The cropped region, in image-space pixels. */
  readonly rect: Rect;
}

/**
 * Apply a crop and return a SourceImage at the crop's pixel size. The
 * rect is rounded and clamped against the source so an oversized rect
 * doesn't crash — we draw what fits.
 */
export function bakeCrop(source: SourceImage, input: CropBakeInput): SourceImage {
  const rounded = roundRect(input.rect);
  const x = clamp(rounded.x, 0, source.width);
  const y = clamp(rounded.y, 0, source.height);
  const w = clamp(rounded.width, 1, source.width - x);
  const h = clamp(rounded.height, 1, source.height - y);

  const bake = createBakeCanvas(w, h);
  if (bake.kind === 'offscreen') {
    const ctx = bake.canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context is not available');
    ctx.drawImage(source.bitmap, x, y, w, h, 0, 0, w, h);
    return { bitmap: bake.canvas, width: w, height: h, mimeType: source.mimeType };
  }
  const ctx = bake.canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context is not available');
  ctx.drawImage(source.bitmap, x, y, w, h, 0, 0, w, h);
  return { bitmap: bake.canvas, width: w, height: h, mimeType: source.mimeType };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
