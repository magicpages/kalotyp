export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

export function rectFromPoints(a: Point, b: Point): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const width = Math.abs(a.x - b.x);
  const height = Math.abs(a.y - b.y);
  return { x, y, width, height };
}

export function rectRight(rect: Rect): number {
  return rect.x + rect.width;
}

export function rectBottom(rect: Rect): number {
  return rect.y + rect.height;
}

export function rectCenter(rect: Rect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

export function pointInRect(point: Point, rect: Rect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

export function rectsEqual(a: Rect, b: Rect): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

/**
 * Translate a rect by `(dx, dy)`, then clamp it inside `bounds` so that the
 * full rect remains inside (clamping translates further if needed; size is
 * preserved). If the rect is larger than the bounds in either axis, that axis
 * is left at the bounds origin.
 */
export function translateClampedRect(rect: Rect, dx: number, dy: number, bounds: Rect): Rect {
  const moved: Rect = { x: rect.x + dx, y: rect.y + dy, width: rect.width, height: rect.height };
  return clampRectInside(moved, bounds);
}

/**
 * Clamp a rect so it fits entirely inside `bounds`. If the rect is larger
 * than the bounds in either axis, the rect's extent in that axis is shrunk
 * to fit (preserving the upper-left anchor of `bounds`).
 */
export function clampRectInside(rect: Rect, bounds: Rect): Rect {
  let { x, y, width, height } = rect;

  if (width > bounds.width) width = bounds.width;
  if (height > bounds.height) height = bounds.height;

  if (x < bounds.x) x = bounds.x;
  if (y < bounds.y) y = bounds.y;
  if (x + width > bounds.x + bounds.width) x = bounds.x + bounds.width - width;
  if (y + height > bounds.y + bounds.height) y = bounds.y + bounds.height - height;

  return { x, y, width, height };
}

export function roundRect(rect: Rect): Rect {
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}
