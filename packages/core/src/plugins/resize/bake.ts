import { type BakeCanvas, createBakeCanvas, getBakeContext2D } from '../../canvas/bake-canvas.js';
import type { SourceImage } from '../utility.js';
import { isResizeNoOp, type ResizeState, resolveOutputSize } from './state.js';

/**
 * Resize `source` to the dimensions implied by `state`. Downscales > 2×
 * run a halving pyramid first so the bilinear-ish `drawImage` scaler
 * doesn't alias.
 */
export async function bakeResize(state: ResizeState, source: SourceImage): Promise<SourceImage> {
  if (isResizeNoOp(state)) return source;
  const { width: targetW, height: targetH } = resolveOutputSize(state, source);
  if (targetW <= 0 || targetH <= 0) return source;

  const halvings = countHalvingsNeeded(source.width, source.height, targetW, targetH);

  let current: { bitmap: CanvasImageSource; width: number; height: number } = {
    bitmap: source.bitmap,
    width: source.width,
    height: source.height,
  };

  // Each halving writes into its own canvas so the source is never reused as destination.
  const intermediates: BakeCanvas[] = [];
  for (let i = 0; i < halvings; i++) {
    const stepW = Math.max(targetW, Math.floor(current.width / 2));
    const stepH = Math.max(targetH, Math.floor(current.height / 2));
    const step = drawScaled(current, stepW, stepH);
    intermediates.push(step);
    current = { bitmap: step.canvas, width: stepW, height: stepH };
  }

  const final = drawScaled(current, targetW, targetH);

  intermediates.length = 0;

  return {
    bitmap: final.canvas,
    width: targetW,
    height: targetH,
    mimeType: source.mimeType,
  };
}

function countHalvingsNeeded(srcW: number, srcH: number, targetW: number, targetH: number): number {
  let w = srcW;
  let h = srcH;
  let count = 0;
  // Defensive cap so a malformed input can't spin forever.
  while ((w / 2 > targetW || h / 2 > targetH) && count < 16) {
    w = Math.floor(w / 2);
    h = Math.floor(h / 2);
    count += 1;
  }
  return count;
}

function drawScaled(
  current: { bitmap: CanvasImageSource; width: number; height: number },
  outW: number,
  outH: number,
): BakeCanvas {
  const bake = createBakeCanvas(outW, outH);
  const ctx = getBakeContext2D(bake);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(current.bitmap, 0, 0, current.width, current.height, 0, 0, outW, outH);
  return bake;
}
