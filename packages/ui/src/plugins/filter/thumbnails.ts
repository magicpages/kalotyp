import {
  applyFinetuneToImageData,
  type FilterPreset,
  type FilterPresetId,
  type RasterImage,
} from '@magicpages/kalotyp-core';

/**
 * Filter-strip thumbnails. Uses the same `applyFinetuneToImageData` as bake+preview, so
 * the thumbnail honestly previews the saved result (modulo source→thumbnail resampling).
 */

export const THUMBNAIL_MAX_WIDTH = 80;
export const THUMBNAIL_MAX_HEIGHT = 60;

export interface ThumbnailDims {
  readonly width: number;
  readonly height: number;
}

/** Largest aspect-preserving fit inside the THUMBNAIL_MAX_* box. */
export function computeThumbnailDims(source: { width: number; height: number }): ThumbnailDims {
  if (source.width <= 0 || source.height <= 0) {
    return { width: THUMBNAIL_MAX_WIDTH, height: THUMBNAIL_MAX_HEIGHT };
  }
  const widthRatio = THUMBNAIL_MAX_WIDTH / source.width;
  const heightRatio = THUMBNAIL_MAX_HEIGHT / source.height;
  const ratio = Math.min(widthRatio, heightRatio);
  const width = Math.max(1, Math.floor(source.width * ratio));
  const height = Math.max(1, Math.floor(source.height * ratio));
  return { width, height };
}

export interface ThumbnailCache {
  get(preset: FilterPreset): HTMLCanvasElement;
  dispose(): void;
}

export interface BuildThumbnailCacheOptions {
  readonly source: CanvasImageSource & { readonly width?: number; readonly height?: number };
  readonly dims: ThumbnailDims;
  readonly dpr: number;
  readonly presets?: readonly FilterPreset[];
}

/** Lazy-rendered preset cache. Baseline ImageData is captured once so per-preset cost is math + putImageData. */
export function buildThumbnailCache(options: BuildThumbnailCacheOptions): ThumbnailCache {
  const { source, dims, dpr } = options;
  const pxW = Math.max(1, Math.round(dims.width * dpr));
  const pxH = Math.max(1, Math.round(dims.height * dpr));

  // Render source at thumbnail pixel-grid once; this baseline ImageData feeds every preset's math.
  const baselineCanvas = document.createElement('canvas');
  baselineCanvas.width = pxW;
  baselineCanvas.height = pxH;
  const baselineCtx = baselineCanvas.getContext('2d', { willReadFrequently: true });
  if (!baselineCtx) {
    return {
      get: () => makeBlankCanvas(dims, dpr),
      dispose: () => {},
    };
  }
  baselineCtx.imageSmoothingEnabled = true;
  baselineCtx.imageSmoothingQuality = 'high';
  baselineCtx.drawImage(source, 0, 0, pxW, pxH);
  const baselineImageData = baselineCtx.getImageData(0, 0, pxW, pxH);
  const baseline: RasterImage = {
    data: new Uint8ClampedArray(baselineImageData.data),
    width: pxW,
    height: pxH,
  };

  const cache = new Map<FilterPresetId, HTMLCanvasElement>();

  function renderPreset(preset: FilterPreset): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = pxW;
    canvas.height = pxH;
    canvas.style.width = `${dims.width}px`;
    canvas.style.height = `${dims.height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    const dst: RasterImage = {
      data: new Uint8ClampedArray(baseline.data.length),
      width: pxW,
      height: pxH,
    };
    applyFinetuneToImageData(preset.state, baseline, dst);
    ctx.putImageData(new ImageData(dst.data, pxW, pxH), 0, 0);
    return canvas;
  }

  return {
    get(preset: FilterPreset): HTMLCanvasElement {
      const existing = cache.get(preset.id);
      if (existing) return existing;
      const canvas = renderPreset(preset);
      cache.set(preset.id, canvas);
      return canvas;
    },
    dispose(): void {
      cache.clear();
    },
  };
}

function makeBlankCanvas(dims: ThumbnailDims, dpr: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(dims.width * dpr));
  canvas.height = Math.max(1, Math.round(dims.height * dpr));
  canvas.style.width = `${dims.width}px`;
  canvas.style.height = `${dims.height}px`;
  return canvas;
}
