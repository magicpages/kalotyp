import { createBakeCanvas, getBakeContext2D } from '../../canvas/bake-canvas.js';
import type { SourceImage } from '../utility.js';
import { type FlipState, isFlipNoOp } from './state.js';

/** Apply horizontal / vertical flips via a sign-flipped scale on `drawImage`. */
export async function bakeFlip(state: FlipState, source: SourceImage): Promise<SourceImage> {
  if (isFlipNoOp(state)) return source;

  const { width, height } = source;
  const bake = createBakeCanvas(width, height);
  const ctx = getBakeContext2D(bake);

  const sx = state.horizontal ? -1 : 1;
  const sy = state.vertical ? -1 : 1;
  const tx = state.horizontal ? width : 0;
  const ty = state.vertical ? height : 0;

  ctx.setTransform(sx, 0, 0, sy, tx, ty);
  ctx.drawImage(source.bitmap, 0, 0);

  return {
    bitmap: bake.canvas,
    width,
    height,
    mimeType: source.mimeType,
  };
}
