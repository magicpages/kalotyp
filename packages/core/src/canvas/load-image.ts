import { isSvgBlob, resolveSvgPixelSize } from './svg-source.js';

export interface LoadedImage {
  readonly element: ImageBitmap | HTMLImageElement | HTMLCanvasElement;
  readonly width: number;
  readonly height: number;
}

/**
 * Load a source image and decode it for canvas use.
 *
 * SVGs are rasterised up front (see `rasterizeSvgBlob`): `createImageBitmap`
 * can't decode them and the `<img>` fallback mis-sizes SVGs without intrinsic
 * dimensions, which corrupts every source-rectangle `drawImage` downstream.
 *
 * The raster path otherwise uses `createImageBitmap(blob, { imageOrientation:
 * 'from-image' })` so EXIF orientation is baked into the pixels — without this,
 * phone photos load sideways because canvas `drawImage` ignores the EXIF flag.
 * Fallback to `HTMLImageElement` when `createImageBitmap` isn't usable; EXIF
 * orientation is not applied on that path.
 */
export async function loadImage(src: string | Blob | File): Promise<LoadedImage> {
  const blob = await toBlob(src);

  // SVG: rasterise to a fixed pixel size before anything downstream touches it.
  // Gate on a DOM being present, and inside the browser let any rasterisation
  // *failure* propagate rather than catching it — falling back to the generic
  // `<img>` path would silently reintroduce the very bug this branch fixes
  // (a no-intrinsic-size SVG loading tiny and mis-cropping). A non-DOM host
  // falls through to the generic paths only for parity with prior behaviour.
  if (blob && isSvgBlob(blob) && typeof document !== 'undefined') {
    return rasterizeSvgBlob(blob);
  }

  if (typeof createImageBitmap === 'function' && blob) {
    try {
      const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      return { element: bitmap, width: bitmap.width, height: bitmap.height };
    } catch {
      // Older Safari rejects the options object; fall through.
    }
  }

  return loadViaImageElement(src);
}

async function toBlob(src: string | Blob | File): Promise<Blob | null> {
  if (src instanceof Blob) return src;
  if (typeof fetch !== 'function') return null;
  try {
    const response = await fetch(src, { credentials: 'omit' });
    if (!response.ok) return null;
    return await response.blob();
  } catch {
    return null;
  }
}

/**
 * Rasterise an SVG blob to a canvas at a size derived from its own metadata
 * (`resolveSvgPixelSize`). The `<img>` element decodes the vector; drawing it
 * with an explicit destination size (and no source rectangle) rasterises it
 * crisply, and the returned canvas behaves like any other bitmap thereafter.
 */
async function rasterizeSvgBlob(blob: Blob): Promise<LoadedImage> {
  const url = URL.createObjectURL(blob);
  try {
    const [markup, element] = await Promise.all([blob.text(), decodeImageElement(url)]);
    const fallback = {
      width: element.naturalWidth || 300,
      height: element.naturalHeight || 150,
    };
    const size = resolveSvgPixelSize(markup, fallback);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context is not available');
    ctx.drawImage(element, 0, 0, size.width, size.height);
    return { element: canvas, width: size.width, height: size.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function loadViaImageElement(src: string | Blob | File): Promise<LoadedImage> {
  const url = typeof src === 'string' ? src : URL.createObjectURL(src);
  const ownsObjectUrl = typeof src !== 'string';

  try {
    const element = await decodeImageElement(url);
    return {
      element,
      width: element.naturalWidth,
      height: element.naturalHeight,
    };
  } finally {
    if (ownsObjectUrl) URL.revokeObjectURL(url);
  }
}

function decodeImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}
