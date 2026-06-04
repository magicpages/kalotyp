/**
 * Allocate a canvas suitable for an off-screen bake operation.
 *
 * The two return shapes are a discriminated union because the `toBlob`
 * vs `convertToBlob` signatures differ — callers pass through whichever
 * they got.
 */
export type BakeCanvas =
  | { readonly kind: 'offscreen'; readonly canvas: OffscreenCanvas }
  | { readonly kind: 'html'; readonly canvas: HTMLCanvasElement };

export function createBakeCanvas(width: number, height: number): BakeCanvas {
  if (canUseOffscreenForBlobs()) {
    const canvas = new OffscreenCanvas(width, height);
    return { kind: 'offscreen', canvas };
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return { kind: 'html', canvas };
}

/**
 * Get a 2D rendering context from either canvas shape with a single
 * narrowed type. Branching on `bake.kind` first lets TS narrow each
 * canvas's `getContext('2d')` correctly; calling it on the un-discriminated
 * union collapses the return to the broader `RenderingContext`.
 */
export function getBakeContext2D(
  bake: BakeCanvas,
): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D {
  if (bake.kind === 'offscreen') {
    const ctx = bake.canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context is not available');
    return ctx;
  }
  const ctx = bake.canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context is not available');
  return ctx;
}

export async function bakeCanvasToBlob(
  bake: BakeCanvas,
  mimeType: string,
  quality: number,
): Promise<Blob> {
  if (bake.kind === 'offscreen') {
    return bake.canvas.convertToBlob({ type: mimeType, quality });
  }
  return new Promise<Blob>((resolve, reject) => {
    bake.canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('toBlob produced null'));
      },
      mimeType,
      quality,
    );
  });
}

function canUseOffscreenForBlobs(): boolean {
  if (typeof OffscreenCanvas === 'undefined') return false;
  // WebKit historically shipped OffscreenCanvas without convertToBlob,
  // so test the actual capability rather than the constructor.
  return typeof OffscreenCanvas.prototype.convertToBlob === 'function';
}

/** Probe whether the runtime canvas can encode `mimeType` to a non-empty blob. Cached per-mime. */
const mimeSupportCache = new Map<string, Promise<boolean>>();

export function canEncodeMime(mimeType: string): Promise<boolean> {
  const cached = mimeSupportCache.get(mimeType);
  if (cached) return cached;
  const probe = (async () => {
    try {
      const bake = createBakeCanvas(1, 1);
      const blob = await bakeCanvasToBlob(bake, mimeType, 0.5);
      // `toBlob` will silently fall back to PNG on unsupported types,
      // so verify the result advertises the requested mime.
      return blob.type === mimeType && blob.size > 0;
    } catch {
      return false;
    }
  })();
  mimeSupportCache.set(mimeType, probe);
  return probe;
}
