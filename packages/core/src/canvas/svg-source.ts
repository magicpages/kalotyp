/**
 * SVG source handling.
 *
 * `createImageBitmap` cannot decode SVG blobs in Chromium ("the source image
 * could not be decoded"), so SVGs always take the `<img>`-element fallback in
 * `load-image.ts`. An SVG that declares no pixel `width`/`height` then loads at
 * a small browser-default intrinsic size (e.g. 300×150 / 200×150) regardless of
 * its `viewBox`. Baking a crop draws that element through
 * `drawImage(img, sx, sy, sw, sh, …)` with a *source rectangle*, and a source
 * rectangle over a no-intrinsic-size SVG element mis-maps: the output comes out
 * tiny with the content collapsed into the top-left corner instead of cropped.
 *
 * The fix is to rasterise the SVG once, up front, at a pixel size derived from
 * its own metadata, and hand the rest of the pipeline that raster (a real
 * canvas, on which source-rectangle draws behave correctly). This module owns
 * the metadata → pixel-size decision — pure and unit-tested; `load-image.ts`
 * owns the actual canvas rasterisation.
 */

import type { Size } from '../geometry/rect.js';

/** The single canonical SVG mime. */
export const SVG_MIME = 'image/svg+xml';

/**
 * Upper bound on a rasterised SVG's longest edge. Mirrors the resize tool's
 * `MAX_DIMENSION` so a hostile `viewBox="0 0 999999 999999"` can't allocate a
 * multi-gigapixel canvas. Applied proportionally, so aspect ratio is preserved.
 */
export const MAX_SVG_RASTER_DIMENSION = 8000;

/** Square default used only when an SVG declares no usable size at all. */
const DEFAULT_SVG_RASTER_SIZE = 512;

/** True when the blob advertises the SVG mime (tolerant of a `; charset=…` suffix). */
export function isSvgBlob(blob: Blob): boolean {
  const [mime] = blob.type.split(';', 1);
  return mime.trim().toLowerCase() === SVG_MIME;
}

/**
 * Resolve the pixel size to rasterise an SVG at, from its markup.
 *
 * Preference order: explicit px `width` + `height`; then `viewBox` (scaled to a
 * lone px `width`/`height` if exactly one is given, else used outright); then
 * the `fallback` (the browser's reported intrinsic size). The result is rounded
 * and proportionally clamped to `[1, MAX_SVG_RASTER_DIMENSION]`.
 */
export function resolveSvgPixelSize(markup: string, fallback: Size): Size {
  const svg = parseSvgRoot(markup);
  if (!svg) return normalizeSize(fallback);

  const width = parseCssPixelLength(svg.getAttribute('width'));
  const height = parseCssPixelLength(svg.getAttribute('height'));
  const viewBox = parseViewBox(svg.getAttribute('viewBox'));

  if (width !== undefined && height !== undefined) {
    return normalizeSize({ width, height });
  }
  if (viewBox) {
    if (width !== undefined) {
      return normalizeSize({ width, height: (width * viewBox.height) / viewBox.width });
    }
    if (height !== undefined) {
      return normalizeSize({ width: (height * viewBox.width) / viewBox.height, height });
    }
    return normalizeSize(viewBox);
  }
  if (width !== undefined) {
    return normalizeSize({ width, height: (width * fallback.height) / fallback.width });
  }
  if (height !== undefined) {
    return normalizeSize({ width: (height * fallback.width) / fallback.height, height });
  }
  return normalizeSize(fallback);
}

function parseSvgRoot(markup: string): Element | null {
  if (typeof DOMParser === 'undefined') return null;
  try {
    const doc = new DOMParser().parseFromString(markup, SVG_MIME);
    if (doc.getElementsByTagName('parsererror').length > 0) return null;
    const root = doc.documentElement;
    return root && root.localName.toLowerCase() === 'svg' ? root : null;
  } catch {
    return null;
  }
}

/** Parse a CSS length, accepting unitless and `px` only. Rejects `%`, `em`, etc. */
function parseCssPixelLength(raw: string | null): number | undefined {
  if (raw === null) return undefined;
  const match = raw.trim().match(/^\+?(\d*\.?\d+)(?:px)?$/i);
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function parseViewBox(raw: string | null): Size | undefined {
  if (raw === null) return undefined;
  const parts = raw
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (parts.length !== 4) return undefined;
  const [, , width, height] = parts;
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
    ? { width, height }
    : undefined;
}

function normalizeSize(size: Size): Size {
  let { width, height } = size;
  if (!(width > 0) || !(height > 0)) {
    return { width: DEFAULT_SVG_RASTER_SIZE, height: DEFAULT_SVG_RASTER_SIZE };
  }
  const longest = Math.max(width, height);
  if (longest > MAX_SVG_RASTER_DIMENSION) {
    const scale = MAX_SVG_RASTER_DIMENSION / longest;
    width *= scale;
    height *= scale;
  }
  return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) };
}
