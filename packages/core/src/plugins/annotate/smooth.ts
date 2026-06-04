/**
 * Freehand stroke decimation + midpoint-curve smoothing. Decimation drops
 * sub-pixel samples from the raw pointer stream; the curve smoothing
 * happens at draw time so stored points stay unchanged across edits.
 */

import type { Point } from '../../geometry/rect.js';

export const MIN_SAMPLE_DISTANCE = 2;

/** Drop interior points closer than `MIN_SAMPLE_DISTANCE` to the previous kept point. */
export function decimatePoints(points: ReadonlyArray<Point>): Point[] {
  if (points.length <= 1) return [...points];
  const head = points[0];
  if (!head) return [];
  const out: Point[] = [head];
  let last = head;
  const minSq = MIN_SAMPLE_DISTANCE * MIN_SAMPLE_DISTANCE;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    if (!p) continue;
    const dx = p.x - last.x;
    const dy = p.y - last.y;
    if (dx * dx + dy * dy < minSq) continue;
    out.push(p);
    last = p;
  }
  // Always keep the final sample so the stroke ends where the pen lifted.
  const tail = points[points.length - 1];
  if (tail && tail !== last) out.push(tail);
  return out;
}

/**
 * Trace a smoothed path through `points` using the midpoint-curve technique.
 * Caller owns `beginPath`, stroke style, and `stroke()` so blend modes
 * (highlight) can wrap this without re-implementing the curve math.
 */
export function tracePath(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  points: ReadonlyArray<Point>,
): void {
  if (points.length === 0) return;
  const head = points[0];
  if (!head) return;
  if (points.length === 1) {
    // Single tap: zero-length segment relies on round lineCap to render a dot.
    ctx.moveTo(head.x, head.y);
    ctx.lineTo(head.x, head.y);
    return;
  }
  ctx.moveTo(head.x, head.y);
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (!a || !b) continue;
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    ctx.quadraticCurveTo(a.x, a.y, midX, midY);
  }
  const last = points[points.length - 1];
  if (last) ctx.lineTo(last.x, last.y);
}
