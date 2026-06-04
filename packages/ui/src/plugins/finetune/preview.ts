import {
  type FinetuneState,
  applyClarity,
  applyFinetuneLutAndSaturation,
  boxBlur3x3,
  buildFinetuneLut,
  isFinetuneNoOp,
} from '@magicpages/kalotyp-core';

/**
 * Finetune preview pipeline. Operates on display-res pixels (a 4000×3000 photo letterboxed to
 * ~720×480 at DPR 2 is ~1.4 MP — the six-adjust composed pass measures ~5 ms there).
 */
export interface FinetunePreviewPipeline {
  paint(state: FinetuneState): void;
  rebuild(width: number, height: number): void;
  dispose(): void;
}

interface PreviewBuffers {
  baseline: Uint8ClampedArray;
  scratch: Uint8ClampedArray;
  /** Pre-blurred baseline for clarity; rebuilt with baseline. */
  blurred: Uint8ClampedArray | undefined;
  width: number;
  height: number;
}

export interface BuildPreviewPipelineOptions {
  readonly canvas: HTMLCanvasElement;
  readonly sourceBitmap: CanvasImageSource;
}

export function buildFinetunePreviewPipeline(
  options: BuildPreviewPipelineOptions,
): FinetunePreviewPipeline {
  const { canvas, sourceBitmap } = options;
  let buffers: PreviewBuffers | undefined;

  function rebuild(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    // willReadFrequently keeps the backing store CPU-side, avoiding a GPU sync per getImageData — load-bearing here.
    const ctx = getReadFrequentContext(canvas);
    if (!ctx) return;
    canvas.width = width;
    canvas.height = height;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(sourceBitmap, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    buffers = {
      baseline: new Uint8ClampedArray(imageData.data),
      scratch: imageData.data,
      blurred: undefined,
      width,
      height,
    };
  }

  function paint(state: FinetuneState): void {
    if (!buffers) return;
    const ctx = getReadFrequentContext(canvas);
    if (!ctx) return;

    if (isFinetuneNoOp(state)) {
      // Paint a fresh copy of baseline (not scratch) so releasing every slider is bit-exact "this is the source".
      const imageData = new ImageData(
        new Uint8ClampedArray(buffers.baseline),
        buffers.width,
        buffers.height,
      );
      ctx.putImageData(imageData, 0, 0);
      return;
    }

    const lut = buildFinetuneLut(state);
    applyFinetuneLutAndSaturation(buffers.baseline, buffers.scratch, lut, state);

    if (state.clarity !== 0) {
      // Lazy-cached blurred baseline; invalidated on every rebuild.
      if (!buffers.blurred) {
        const tmp = new Uint8ClampedArray(buffers.baseline.length);
        const blurred = new Uint8ClampedArray(buffers.baseline.length);
        boxBlur3x3(buffers.baseline, tmp, blurred, buffers.width, buffers.height);
        buffers.blurred = blurred;
      }
      applyClarity(buffers.scratch, buffers.blurred, state.clarity);
    }

    const imageData = new ImageData(buffers.scratch, buffers.width, buffers.height);
    ctx.putImageData(imageData, 0, 0);
  }

  function dispose(): void {
    buffers = undefined;
  }

  return { paint, rebuild, dispose };
}

// getContext returns the first-acquired context; subsequent attribute args are ignored, so this helper is safe to call from both rebuild and paint.
function getReadFrequentContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  return canvas.getContext('2d', { willReadFrequently: true });
}
