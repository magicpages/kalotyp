import { type Point, type Rect, clampRectInside } from '../../geometry/rect.js';
import { type AspectAnchor, applyAspectRatio } from './aspect-ratio.js';

export type CornerHandle = 'tl' | 'tr' | 'bl' | 'br';
export type EdgeHandle = 't' | 'r' | 'b' | 'l';
export type HandleDirection = CornerHandle | EdgeHandle;

export interface ResizeOptions {
  /** Image-space bounds the rect must stay inside. */
  readonly bounds: Rect;
  /** Aspect ratio to enforce, or `undefined` for free crop. */
  readonly aspectRatio?: number;
  /** Minimum size on either axis, in image-space units. Defaults to 1. */
  readonly minSize?: number;
}

/**
 * Resize a rect from one of its eight handles to `pointer`. Opposite
 * corner/edge anchors; result clamped to `bounds` and reshaped to
 * `aspectRatio` (anchored at the same opposite corner) when supplied.
 */
export function resizeRectFromHandle(
  rect: Rect,
  handle: HandleDirection,
  pointer: Point,
  options: ResizeOptions,
): Rect {
  const minSize = options.minSize ?? 1;
  const left = rect.x;
  const top = rect.y;
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;

  // Pointer may swap sides (drag through the anchor); recompute from anchor + live edge.
  let newLeft = left;
  let newTop = top;
  let newRight = right;
  let newBottom = bottom;

  if (handle === 'tl' || handle === 'l' || handle === 'bl') {
    newLeft = pointer.x;
  }
  if (handle === 'tr' || handle === 'r' || handle === 'br') {
    newRight = pointer.x;
  }
  if (handle === 'tl' || handle === 't' || handle === 'tr') {
    newTop = pointer.y;
  }
  if (handle === 'bl' || handle === 'b' || handle === 'br') {
    newBottom = pointer.y;
  }

  if (handle === 'l' || handle === 'r') {
    newTop = top;
    newBottom = bottom;
  }
  if (handle === 't' || handle === 'b') {
    newLeft = left;
    newRight = right;
  }

  let nx = Math.min(newLeft, newRight);
  let ny = Math.min(newTop, newBottom);
  let nw = Math.abs(newRight - newLeft);
  let nh = Math.abs(newBottom - newTop);

  if (nw < minSize) {
    nw = minSize;
    if (handle === 'tl' || handle === 'l' || handle === 'bl') {
      nx = right - minSize;
    } else if (handle === 'tr' || handle === 'r' || handle === 'br') {
      nx = left;
    }
  }
  if (nh < minSize) {
    nh = minSize;
    if (handle === 'tl' || handle === 't' || handle === 'tr') {
      ny = bottom - minSize;
    } else if (handle === 'bl' || handle === 'b' || handle === 'br') {
      ny = top;
    }
  }

  let resized: Rect = { x: nx, y: ny, width: nw, height: nh };
  resized = clampRectInside(resized, options.bounds);

  if (options.aspectRatio !== undefined && options.aspectRatio > 0) {
    resized = applyAspectRatio(resized, options.aspectRatio, anchorFor(handle), options.bounds);
  }

  return resized;
}

function anchorFor(handle: HandleDirection): AspectAnchor {
  switch (handle) {
    case 'tl':
      return 'br';
    case 'tr':
      return 'bl';
    case 'bl':
      return 'tr';
    case 'br':
      return 'tl';
    case 't':
      return 'bl';
    case 'b':
      return 'tl';
    case 'l':
      return 'tr';
    case 'r':
      return 'tl';
  }
}
