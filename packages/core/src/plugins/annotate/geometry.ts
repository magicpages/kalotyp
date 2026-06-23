import type { Rect } from '../../geometry/rect.js';
import { assertNever, normalizeTextShape, type Shape } from './state.js';
import { estimateLineWidth, layoutTextLines } from './text-layout.js';

/**
 * Axis-aligned bounding box in image-space pixels. `shape.x, shape.y` is the
 * text block's top-left for every `textAlign` (alignment justifies lines within
 * the block, it doesn't move the origin), so the box origin is the anchor. A
 * font-metric estimate is used here (jsdom's `measureText` returns 0); the
 * renderer measures real text at paint time.
 */
export function boundingBoxOf(shape: Shape): Rect {
  switch (shape.kind) {
    case 'text': {
      const text = normalizeTextShape(shape);
      const { width, height } = layoutTextLines(text, (line) =>
        estimateLineWidth(line, text.fontSize),
      );
      return { x: text.x, y: text.y, width, height };
    }
    case 'rect':
    case 'ellipse':
      return { x: shape.x, y: shape.y, width: shape.width, height: shape.height };
    case 'arrow': {
      const x = Math.min(shape.x1, shape.x2);
      const y = Math.min(shape.y1, shape.y2);
      return {
        x,
        y,
        width: Math.abs(shape.x2 - shape.x1),
        height: Math.abs(shape.y2 - shape.y1),
      };
    }
    case 'freehand':
    case 'highlight': {
      const head = shape.points[0];
      if (!head) return { x: 0, y: 0, width: 0, height: 0 };
      let minX = head.x;
      let minY = head.y;
      let maxX = head.x;
      let maxY = head.y;
      for (const p of shape.points) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
    default:
      return assertNever(shape);
  }
}

/**
 * Eight-handle layout (corners + edges). Arrows reuse `tl`/`br` as
 * endpoint handles; callers detect arrow handles by shape kind.
 */
export type SelectionHandle = 'tl' | 'tr' | 'bl' | 'br' | 't' | 'r' | 'b' | 'l';

export const ALL_SELECTION_HANDLES: readonly SelectionHandle[] = [
  'tl',
  'tr',
  'bl',
  'br',
  't',
  'r',
  'b',
  'l',
];

/** Image-space coordinates for each handle; renderer projects to display. */
export function selectionHandlePositions(
  rect: Rect,
): Record<SelectionHandle, { x: number; y: number }> {
  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  return {
    tl: { x: left, y: top },
    tr: { x: right, y: top },
    bl: { x: left, y: bottom },
    br: { x: right, y: bottom },
    t: { x: cx, y: top },
    r: { x: right, y: cy },
    b: { x: cx, y: bottom },
    l: { x: left, y: cy },
  };
}

/** Apply a handle drag to a rect. Returns the new rect; the caller normalises. */
export function rectFromHandleDrag(
  initial: Rect,
  handle: SelectionHandle,
  pointer: { x: number; y: number },
): Rect {
  let x = initial.x;
  let y = initial.y;
  let right = initial.x + initial.width;
  let bottom = initial.y + initial.height;

  if (handle === 'tl' || handle === 'l' || handle === 'bl') x = pointer.x;
  if (handle === 'tr' || handle === 'r' || handle === 'br') right = pointer.x;
  if (handle === 'tl' || handle === 't' || handle === 'tr') y = pointer.y;
  if (handle === 'bl' || handle === 'b' || handle === 'br') bottom = pointer.y;

  return { x, y, width: right - x, height: bottom - y };
}
