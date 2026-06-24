import type { Point } from '../../geometry/rect.js';
import { boundingBoxOf } from './geometry.js';
import { assertNever, type Shape } from './state.js';

/** Picking margin added to every stroked-shape hit-test, in image-space pixels. */
export const PICK_TOLERANCE = 4;

/** Find the topmost shape under `point` (image-space). Iterates back-to-front. */
export function pickShape(shapes: ReadonlyArray<Shape>, point: Point): Shape | undefined {
  for (let i = shapes.length - 1; i >= 0; i--) {
    const shape = shapes[i];
    if (shape && hitTest(shape, point)) return shape;
  }
  return undefined;
}

export function hitTest(shape: Shape, point: Point): boolean {
  switch (shape.kind) {
    case 'text':
    case 'emoji':
      // Both pick anywhere inside their (filled) box.
      return pointInRect(point, boundingBoxOf(shape));
    case 'rect': {
      const inside = pointInRect(point, normaliseBox(shape));
      // Filled rects pick anywhere inside; outline-only picks on the stroke (with tolerance).
      if (shape.fillColor !== null) return inside;
      const outer = expandRect(normaliseBox(shape), shape.strokeWidth / 2 + PICK_TOLERANCE);
      const inner = expandRect(normaliseBox(shape), -(shape.strokeWidth / 2 + PICK_TOLERANCE));
      return pointInRect(point, outer) && !pointInRect(point, inner);
    }
    case 'ellipse': {
      const box = normaliseBox(shape);
      const rx = box.width / 2;
      const ry = box.height / 2;
      const cx = box.x + rx;
      const cy = box.y + ry;
      if (rx <= 0 || ry <= 0) return false;
      const nx = (point.x - cx) / rx;
      const ny = (point.y - cy) / ry;
      const r2 = nx * nx + ny * ny;
      const tolerance = (shape.strokeWidth / 2 + PICK_TOLERANCE) / Math.min(rx, ry);
      if (shape.fillColor !== null) return r2 <= (1 + tolerance) ** 2;
      return r2 <= (1 + tolerance) ** 2 && r2 >= (1 - tolerance) ** 2;
    }
    case 'arrow':
      return pointNearSegment(
        point,
        { x: shape.x1, y: shape.y1 },
        { x: shape.x2, y: shape.y2 },
        shape.strokeWidth / 2 + PICK_TOLERANCE,
      );
    case 'freehand':
    case 'highlight': {
      const box = boundingBoxOf(shape);
      const expanded = expandRect(box, shape.strokeWidth / 2 + PICK_TOLERANCE);
      if (!pointInRect(point, expanded)) return false;
      const tolerance = shape.strokeWidth / 2 + PICK_TOLERANCE;
      for (let i = 1; i < shape.points.length; i++) {
        const a = shape.points[i - 1];
        const b = shape.points[i];
        if (a && b && pointNearSegment(point, a, b, tolerance)) return true;
      }
      if (shape.points.length === 1) {
        const p = shape.points[0];
        if (!p) return false;
        const dx = p.x - point.x;
        const dy = p.y - point.y;
        return dx * dx + dy * dy <= tolerance * tolerance;
      }
      return false;
    }
    default:
      return assertNever(shape);
  }
}

function pointInRect(
  point: Point,
  rect: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    point.x >= rect.x &&
    point.y >= rect.y &&
    point.x <= rect.x + rect.width &&
    point.y <= rect.y + rect.height
  );
}

function expandRect(
  rect: { x: number; y: number; width: number; height: number },
  amount: number,
): { x: number; y: number; width: number; height: number } {
  return {
    x: rect.x - amount,
    y: rect.y - amount,
    width: rect.width + amount * 2,
    height: rect.height + amount * 2,
  };
}

function normaliseBox(shape: { x: number; y: number; width: number; height: number }): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  let { x, y, width, height } = shape;
  if (width < 0) {
    x += width;
    width = -width;
  }
  if (height < 0) {
    y += height;
    height = -height;
  }
  return { x, y, width, height };
}

function pointNearSegment(point: Point, a: Point, b: Point, tolerance: number): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) {
    const ex = point.x - a.x;
    const ey = point.y - a.y;
    return ex * ex + ey * ey <= tolerance * tolerance;
  }
  let t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / len2;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  const ex = point.x - projX;
  const ey = point.y - projY;
  return ex * ex + ey * ey <= tolerance * tolerance;
}
