export interface LoadedImage {
  readonly element: ImageBitmap | HTMLImageElement;
  readonly width: number;
  readonly height: number;
}

/**
 * Load a source image and decode it for canvas use.
 *
 * Modern path uses `createImageBitmap(blob, { imageOrientation: 'from-image' })`
 * so EXIF orientation is baked into the pixels — without this, phone photos
 * load sideways because canvas `drawImage` ignores the EXIF flag.
 * Fallback to `HTMLImageElement` when `createImageBitmap` isn't usable;
 * EXIF orientation is not applied on that path.
 */
export async function loadImage(src: string | Blob | File): Promise<LoadedImage> {
  if (typeof createImageBitmap === 'function') {
    const blob = await toBlob(src);
    if (blob) {
      try {
        const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
        return { element: bitmap, width: bitmap.width, height: bitmap.height };
      } catch {
        // Older Safari rejects the options object; fall through.
      }
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

async function loadViaImageElement(src: string | Blob | File): Promise<LoadedImage> {
  const url = typeof src === 'string' ? src : URL.createObjectURL(src);
  const ownsObjectUrl = typeof src !== 'string';

  try {
    const element = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      img.src = url;
    });
    return {
      element,
      width: element.naturalWidth,
      height: element.naturalHeight,
    };
  } finally {
    if (ownsObjectUrl) URL.revokeObjectURL(url);
  }
}
