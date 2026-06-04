import { createBakeCanvas, getBakeContext2D } from '../../canvas/bake-canvas.js';
import type { SourceImage } from '../utility.js';
import { applyFinetuneToImageData } from './math.js';
import { type FinetuneState, isFinetuneNoOp } from './state.js';

/** Apply the six finetune adjustments at full resolution. Shares the math with the live preview. */
export async function bakeFinetune(
  state: FinetuneState,
  source: SourceImage,
): Promise<SourceImage> {
  if (isFinetuneNoOp(state)) return source;

  const bake = createBakeCanvas(source.width, source.height);
  const ctx = getBakeContext2D(bake);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source.bitmap, 0, 0, source.width, source.height);

  const baseline = ctx.getImageData(0, 0, source.width, source.height);
  // When clarity is non-zero the unsharp-mask step needs `dst` and `blurred`
  // simultaneously, so we can't reuse the baseline buffer in place.
  if (state.clarity === 0) {
    applyFinetuneToImageData(state, baseline, baseline);
    ctx.putImageData(baseline, 0, 0);
  } else {
    const dst = new ImageData(
      new Uint8ClampedArray(baseline.data.length),
      baseline.width,
      baseline.height,
    );
    applyFinetuneToImageData(state, baseline, dst);
    ctx.putImageData(dst, 0, 0);
  }

  return {
    bitmap: bake.canvas,
    width: source.width,
    height: source.height,
    mimeType: source.mimeType,
  };
}
