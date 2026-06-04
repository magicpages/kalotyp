import type { Point, Rect, Size } from '../geometry/rect.js';

export interface StageDimensions {
  /** Stage width in CSS pixels. */
  readonly width: number;
  /** Stage height in CSS pixels. */
  readonly height: number;
  /** Padding on each side around the image, in CSS pixels. */
  readonly padding: number;
}

/**
 * User-driven zoom and pan applied on top of the fit-to-screen letterbox.
 * `computeViewport` folds the transform into `displayRect` and `scale` so
 * plugin-level draw calls stay zoom-agnostic. Pan is in stage CSS pixels
 * at the current zoom and is clamped at viewport emission.
 */
export interface ViewportTransform {
  /** 1 at fit; > 1 zoomed in; < 1 zoomed out. */
  readonly zoom: number;
  /** CSS pixels of pan offset, applied after the centered-fit baseline. */
  readonly panX: number;
  readonly panY: number;
}

export const IDENTITY_VIEWPORT_TRANSFORM: ViewportTransform = Object.freeze({
  zoom: 1,
  panX: 0,
  panY: 0,
});

export interface Viewport {
  /** Where the image is drawn in stage CSS pixels (post-zoom, post-pan). */
  readonly displayRect: Rect;
  /** Display CSS pixels per 1 image pixel (uniform on both axes, post-zoom). */
  readonly scale: number;
}

/**
 * Compute the post-zoom, post-pan display rect for an image inside the stage.
 *
 * At identity, the image is fit-scaled inside the stage minus padding and
 * centered. With a non-identity transform the fit scale is multiplied by
 * `zoom`, then the pan offset is added and clamped so at least 1 image
 * pixel remains inside the inner stage area on each axis.
 */
export function computeViewport(
  stage: StageDimensions,
  image: Size,
  transform: ViewportTransform = IDENTITY_VIEWPORT_TRANSFORM,
): Viewport {
  const innerWidth = Math.max(0, stage.width - stage.padding * 2);
  const innerHeight = Math.max(0, stage.height - stage.padding * 2);

  if (image.width <= 0 || image.height <= 0 || innerWidth <= 0 || innerHeight <= 0) {
    return {
      displayRect: { x: stage.padding, y: stage.padding, width: 0, height: 0 },
      scale: 0,
    };
  }

  const fitScale = Math.min(innerWidth / image.width, innerHeight / image.height);
  const zoom = Math.max(0, transform.zoom || 0);
  const scale = fitScale * zoom;

  const width = image.width * scale;
  const height = image.height * scale;

  // Centered baseline inside the inner stage area, then add the pan.
  const baselineX = stage.padding + (innerWidth - width) / 2;
  const baselineY = stage.padding + (innerHeight - height) / 2;

  const x = baselineX + transform.panX;
  const y = baselineY + transform.panY;

  const clampedX = clampAxis(x, baselineX, width, innerWidth, stage.padding);
  const clampedY = clampAxis(y, baselineY, height, innerHeight, stage.padding);

  return {
    displayRect: { x: clampedX, y: clampedY, width, height },
    scale,
  };
}

function clampAxis(
  rawPos: number,
  baseline: number,
  size: number,
  innerSize: number,
  padding: number,
): number {
  // Image narrower than the inner stage: no off-center pan, baseline is centered.
  if (size <= innerSize) return baseline;

  // At least 1 image pixel always remains inside the inner stage.
  const innerStart = padding;
  const innerEnd = padding + innerSize;
  const minLeft = innerStart + 1 - size;
  const maxLeft = innerEnd - 1;
  if (rawPos < minLeft) return minLeft;
  if (rawPos > maxLeft) return maxLeft;
  return rawPos;
}

export function pointImageToDisplay(point: Point, viewport: Viewport): Point {
  return {
    x: viewport.displayRect.x + point.x * viewport.scale,
    y: viewport.displayRect.y + point.y * viewport.scale,
  };
}

export function pointDisplayToImage(point: Point, viewport: Viewport): Point {
  if (viewport.scale === 0) return { x: 0, y: 0 };
  return {
    x: (point.x - viewport.displayRect.x) / viewport.scale,
    y: (point.y - viewport.displayRect.y) / viewport.scale,
  };
}

export function rectImageToDisplay(rect: Rect, viewport: Viewport): Rect {
  return {
    x: viewport.displayRect.x + rect.x * viewport.scale,
    y: viewport.displayRect.y + rect.y * viewport.scale,
    width: rect.width * viewport.scale,
    height: rect.height * viewport.scale,
  };
}

export function rectDisplayToImage(rect: Rect, viewport: Viewport): Rect {
  if (viewport.scale === 0) return { x: 0, y: 0, width: 0, height: 0 };
  return {
    x: (rect.x - viewport.displayRect.x) / viewport.scale,
    y: (rect.y - viewport.displayRect.y) / viewport.scale,
    width: rect.width / viewport.scale,
    height: rect.height / viewport.scale,
  };
}
