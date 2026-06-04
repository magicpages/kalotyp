import { createBakeCanvas, getBakeContext2D } from '../../canvas/bake-canvas.js';
import type { SourceImage } from '../utility.js';
import { largestInscribedRect } from './inscribe.js';
import { effectiveAngleDeg, isRotateNoOp, type RotateState } from './state.js';

/**
 * Apply rotation = quarter-turns + free-angle in one `drawImage`. Free
 * angles auto-crop to the largest same-aspect rect inside the rotated
 * bounding box so transparent corners stay out of the output.
 */
export async function bakeRotate(state: RotateState, source: SourceImage): Promise<SourceImage> {
  if (isRotateNoOp(state)) return source;

  const angleDeg = effectiveAngleDeg(state);
  const angleRad = (angleDeg * Math.PI) / 180;

  const sub90Deg = angleDeg - state.quarterTurns * 90; // ∈ [-45, 45]
  const isQuarterOnly = Math.abs(sub90Deg) < 1e-6;

  let outWidth: number;
  let outHeight: number;

  if (isQuarterOnly) {
    if (state.quarterTurns === 1 || state.quarterTurns === 3) {
      outWidth = source.height;
      outHeight = source.width;
    } else {
      outWidth = source.width;
      outHeight = source.height;
    }
  } else {
    const inscribed = largestInscribedRect(source, angleRad);
    outWidth = Math.max(1, Math.round(inscribed.width));
    outHeight = Math.max(1, Math.round(inscribed.height));
  }

  const bake = createBakeCanvas(outWidth, outHeight);
  const ctx = getBakeContext2D(bake);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.translate(outWidth / 2, outHeight / 2);
  ctx.rotate(angleRad);
  ctx.drawImage(source.bitmap, -source.width / 2, -source.height / 2);

  return {
    bitmap: bake.canvas,
    width: outWidth,
    height: outHeight,
    mimeType: source.mimeType,
  };
}
