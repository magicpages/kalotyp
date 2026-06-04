import { clampRectInside, type Rect } from '../../geometry/rect.js';

/**
 * Compute the largest axis-aligned rectangle of `targetRatio` (= w/h) that
 * fits inside `bounds`, centered. Used to seed the crop rectangle when the
 * user picks an aspect-ratio preset before any drag.
 */
export function fitRectToBoundsWithRatio(bounds: Rect, targetRatio: number): Rect {
  if (targetRatio <= 0 || bounds.width <= 0 || bounds.height <= 0) {
    return { x: bounds.x, y: bounds.y, width: 0, height: 0 };
  }

  const boundsRatio = bounds.width / bounds.height;
  let width: number;
  let height: number;
  if (targetRatio >= boundsRatio) {
    width = bounds.width;
    height = width / targetRatio;
  } else {
    height = bounds.height;
    width = height * targetRatio;
  }

  return {
    x: bounds.x + (bounds.width - width) / 2,
    y: bounds.y + (bounds.height - height) / 2,
    width,
    height,
  };
}

/**
 * Reshape `rect` to `targetRatio`, anchored at `anchor`, clamped inside
 * `bounds`. If clamping breaks the ratio, falls back to the largest same-ratio
 * sub-rect that fits, anchored identically.
 */
export function applyAspectRatio(
  rect: Rect,
  targetRatio: number,
  anchor: AspectAnchor,
  bounds: Rect,
): Rect {
  if (targetRatio <= 0) return rect;
  if (rect.width <= 0 || rect.height <= 0) return fitRectToBoundsWithRatio(bounds, targetRatio);

  const currentRatio = rect.width / rect.height;
  let width: number;
  let height: number;
  if (currentRatio > targetRatio) {
    height = rect.height;
    width = height * targetRatio;
  } else {
    width = rect.width;
    height = width / targetRatio;
  }

  const reshaped = anchorRect(rect, width, height, anchor);
  const clamped = clampRectInside(reshaped, bounds);

  const clampedRatio = clamped.height === 0 ? 0 : clamped.width / clamped.height;
  if (Math.abs(clampedRatio - targetRatio) <= RATIO_TOLERANCE) {
    return clamped;
  }
  return fitInsideAtAnchor(clamped, targetRatio, anchor);
}

const RATIO_TOLERANCE = 1e-6;

export type AspectAnchor = 'tl' | 'tr' | 'bl' | 'br' | 'center';

function anchorRect(rect: Rect, width: number, height: number, anchor: AspectAnchor): Rect {
  switch (anchor) {
    case 'tl':
      return { x: rect.x, y: rect.y, width, height };
    case 'tr':
      return { x: rect.x + rect.width - width, y: rect.y, width, height };
    case 'bl':
      return { x: rect.x, y: rect.y + rect.height - height, width, height };
    case 'br':
      return {
        x: rect.x + rect.width - width,
        y: rect.y + rect.height - height,
        width,
        height,
      };
    case 'center':
      return {
        x: rect.x + (rect.width - width) / 2,
        y: rect.y + (rect.height - height) / 2,
        width,
        height,
      };
  }
}

function fitInsideAtAnchor(bounds: Rect, targetRatio: number, anchor: AspectAnchor): Rect {
  const fitted = fitRectToBoundsWithRatio(bounds, targetRatio);
  return anchorRect(bounds, fitted.width, fitted.height, anchor);
}
