/**
 * Drawing-tool gesture factories. Each function builds the
 * pointer-drag handlers for one tool (rect, ellipse, arrow, freehand,
 * highlight, plus body-move for the select tool). Text and select
 * dispatch are handled in `mount.ts` because they don't fit the
 * "drag-to-create" shape these factories codify.
 *
 * Each gesture:
 *   1. Mints a fresh shape id and creates an in-progress shape.
 *   2. On every coalesced pointermove, the shape's geometry is
 *      updated and rendered into the live canvas (caller-supplied).
 *   3. On commit (`pointerup`), the shape is added to the store and
 *      a `commit` event is emitted so the editor history snapshots.
 *      A degenerate shape (zero-extent rect, single-tap freehand) is
 *      dropped instead of committed — the user obviously didn't mean
 *      to draw anything.
 */

import {
  type AnnotateState,
  type ArrowShape,
  type EllipseShape,
  type FreehandShape,
  HIGHLIGHT_DEFAULT_COLOR,
  HIGHLIGHT_DEFAULT_STROKE,
  type HighlightShape,
  type Point,
  type RectShape,
  type Shape,
  type Store,
  addShape,
  decimatePoints,
  mintShapeId,
  normaliseRectExtent,
  selectShape,
} from '@magicpages/kalotyp-core';
import type { DragHandlers } from './pointer-drag.js';

/**
 * Shift-modifier constraint helpers. Three flavours, all returning
 * the constrained image-space end-point:
 *
 *  - `constrainSquare`: rect/ellipse drag uses the larger absolute
 *    delta on both axes so the resulting box is a square (and thus
 *    the inscribed ellipse is a circle).
 *  - `constrainAxisOrDiagonal`: arrow drag snaps to the nearest of
 *    eight directions (4 cardinal + 4 diagonal). Length matches the
 *    user's pointer distance projected onto the chosen axis.
 *  - `constrainStroke`: freehand/highlight strokes lock to whichever
 *    axis the cursor moved further along, so a quick shift-drag
 *    draws a straight horizontal or vertical line.
 *
 * Industry convention across Figma / Sketch / Photoshop / Pintura.
 */
function constrainSquare(start: Point, end: Point): Point {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const size = Math.max(Math.abs(dx), Math.abs(dy));
  const sx = dx === 0 ? 1 : Math.sign(dx);
  const sy = dy === 0 ? 1 : Math.sign(dy);
  return { x: start.x + sx * size, y: start.y + sy * size };
}

function constrainAxisOrDiagonal(start: Point, end: Point): Point {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return start;
  // Snap angle to nearest 45° increment (8 compass directions).
  const angle = Math.atan2(dy, dx);
  const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
  return { x: start.x + Math.cos(snapped) * len, y: start.y + Math.sin(snapped) * len };
}

function constrainStroke(start: Point, end: Point): Point {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (Math.abs(dx) >= Math.abs(dy)) return { x: end.x, y: start.y };
  return { x: start.x, y: end.y };
}

export interface ToolGestureContext {
  readonly store: Store<AnnotateState>;
  /** Project a raw client-space pointer to image-space pixels. */
  toImageSpace(clientPoint: { clientX: number; clientY: number }): Point;
  /** Update the live canvas with the in-progress shape. */
  setLiveShape(shape: Shape | null): void;
  /** Emit the editor's history-commit signal. */
  commit(): void;
}

export function startRectGesture(ctx: ToolGestureContext, origin: PointerEvent): DragHandlers {
  const startImage = ctx.toImageSpace(origin);
  const state = ctx.store.get();
  const { id, nextShapeNumber } = mintShapeId(state);
  let lastImage = startImage;
  return {
    onMove(point) {
      const raw = ctx.toImageSpace(point);
      // Shift constrains to a square (and thus the inscribed ellipse
      // would be a circle for the ellipse tool).
      lastImage = point.shiftKey ? constrainSquare(startImage, raw) : raw;
      const draft: RectShape = {
        id,
        kind: 'rect',
        x: startImage.x,
        y: startImage.y,
        width: lastImage.x - startImage.x,
        height: lastImage.y - startImage.y,
        strokeColor: state.currentStyle.color,
        strokeWidth: state.currentStyle.strokeWidth,
        fillColor: state.currentStyle.fillColor,
      };
      ctx.setLiveShape(draft);
    },
    onCommit() {
      const extent = normaliseRectExtent({
        x: startImage.x,
        y: startImage.y,
        width: lastImage.x - startImage.x,
        height: lastImage.y - startImage.y,
      });
      ctx.setLiveShape(null);
      // Drop zero-extent gestures (a click that didn't drag).
      if (extent.width < 2 || extent.height < 2) return;
      const shape: RectShape = {
        id,
        kind: 'rect',
        ...extent,
        strokeColor: state.currentStyle.color,
        strokeWidth: state.currentStyle.strokeWidth,
        fillColor: state.currentStyle.fillColor,
      };
      ctx.store.update((current) => ({ ...addShape(current, shape), nextShapeNumber }));
      ctx.commit();
    },
    onCancel() {
      ctx.setLiveShape(null);
    },
  };
}

export function startEllipseGesture(ctx: ToolGestureContext, origin: PointerEvent): DragHandlers {
  const startImage = ctx.toImageSpace(origin);
  const state = ctx.store.get();
  const { id, nextShapeNumber } = mintShapeId(state);
  let lastImage = startImage;
  return {
    onMove(point) {
      const raw = ctx.toImageSpace(point);
      // Shift constrains the bounding box to a square so the
      // inscribed ellipse becomes a circle.
      lastImage = point.shiftKey ? constrainSquare(startImage, raw) : raw;
      const draft: EllipseShape = {
        id,
        kind: 'ellipse',
        x: startImage.x,
        y: startImage.y,
        width: lastImage.x - startImage.x,
        height: lastImage.y - startImage.y,
        strokeColor: state.currentStyle.color,
        strokeWidth: state.currentStyle.strokeWidth,
        fillColor: state.currentStyle.fillColor,
      };
      ctx.setLiveShape(draft);
    },
    onCommit() {
      const extent = normaliseRectExtent({
        x: startImage.x,
        y: startImage.y,
        width: lastImage.x - startImage.x,
        height: lastImage.y - startImage.y,
      });
      ctx.setLiveShape(null);
      if (extent.width < 2 || extent.height < 2) return;
      const shape: EllipseShape = {
        id,
        kind: 'ellipse',
        ...extent,
        strokeColor: state.currentStyle.color,
        strokeWidth: state.currentStyle.strokeWidth,
        fillColor: state.currentStyle.fillColor,
      };
      ctx.store.update((current) => ({ ...addShape(current, shape), nextShapeNumber }));
      ctx.commit();
    },
    onCancel() {
      ctx.setLiveShape(null);
    },
  };
}

export function startArrowGesture(ctx: ToolGestureContext, origin: PointerEvent): DragHandlers {
  const startImage = ctx.toImageSpace(origin);
  const state = ctx.store.get();
  const { id, nextShapeNumber } = mintShapeId(state);
  let lastImage = startImage;
  return {
    onMove(point) {
      const raw = ctx.toImageSpace(point);
      // Shift snaps arrow direction to the nearest 45° increment
      // (4 cardinal + 4 diagonal). Length follows the projection.
      lastImage = point.shiftKey ? constrainAxisOrDiagonal(startImage, raw) : raw;
      const draft: ArrowShape = {
        id,
        kind: 'arrow',
        x1: startImage.x,
        y1: startImage.y,
        x2: lastImage.x,
        y2: lastImage.y,
        color: state.currentStyle.color,
        strokeWidth: state.currentStyle.strokeWidth,
      };
      ctx.setLiveShape(draft);
    },
    onCommit() {
      ctx.setLiveShape(null);
      const dx = lastImage.x - startImage.x;
      const dy = lastImage.y - startImage.y;
      // Arrow needs at least a few image-space pixels of length to
      // be meaningful; otherwise it's a click.
      if (dx * dx + dy * dy < 16) return;
      const shape: ArrowShape = {
        id,
        kind: 'arrow',
        x1: startImage.x,
        y1: startImage.y,
        x2: lastImage.x,
        y2: lastImage.y,
        color: state.currentStyle.color,
        strokeWidth: state.currentStyle.strokeWidth,
      };
      ctx.store.update((current) => ({ ...addShape(current, shape), nextShapeNumber }));
      ctx.commit();
    },
    onCancel() {
      ctx.setLiveShape(null);
    },
  };
}

export function startFreehandGesture(
  ctx: ToolGestureContext,
  origin: PointerEvent,
  options: { kind: 'freehand' | 'highlight' },
): DragHandlers {
  const startImage = ctx.toImageSpace(origin);
  const state = ctx.store.get();
  const { id, nextShapeNumber } = mintShapeId(state);
  /**
   * Two parallel point streams:
   *
   *  - `freePoints` — the natural freehand path, recorded every move
   *    regardless of shift state. Used when shift is released so a
   *    user can press-and-release shift mid-stroke without losing
   *    earlier curvy segments.
   *  - The render path is computed per-frame: while shift is held
   *    we render a straight axis-locked line from `startImage` to
   *    the projected end-point; otherwise we render the full
   *    freehand path.
   *
   * On commit we choose: if shift was held at release, the persisted
   * shape is just the two endpoints; otherwise the decimated free path.
   */
  const freePoints: Point[] = [startImage];
  let lastWasShift = false;
  let lastConstrainedEnd: Point = startImage;
  const isHighlight = options.kind === 'highlight';
  const color = isHighlight ? HIGHLIGHT_DEFAULT_COLOR : state.currentStyle.color;
  const strokeWidth = isHighlight ? HIGHLIGHT_DEFAULT_STROKE : state.currentStyle.strokeWidth;

  function paint(points: ReadonlyArray<Point>): void {
    const draft: FreehandShape | HighlightShape = {
      id,
      kind: options.kind,
      points,
      color,
      strokeWidth,
    };
    ctx.setLiveShape(draft);
  }

  return {
    onMove(point) {
      const raw = ctx.toImageSpace(point);
      lastWasShift = point.shiftKey;
      if (point.shiftKey) {
        // Lock the stroke to a horizontal/vertical line from the
        // gesture's start to the current pointer projection.
        lastConstrainedEnd = constrainStroke(startImage, raw);
        paint([startImage, lastConstrainedEnd]);
      } else {
        freePoints.push(raw);
        paint(freePoints);
      }
    },
    onCommit() {
      ctx.setLiveShape(null);
      const finalPoints: ReadonlyArray<Point> = lastWasShift
        ? [startImage, lastConstrainedEnd]
        : decimatePoints(freePoints);
      if (finalPoints.length < 2) return;
      // Reject zero-length shift-clicks.
      if (finalPoints.length === 2) {
        const a = finalPoints[0];
        const b = finalPoints[1];
        if (a && b) {
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          if (dx * dx + dy * dy < 4) return;
        }
      }
      const shape: FreehandShape | HighlightShape = {
        id,
        kind: options.kind,
        points: finalPoints,
        color,
        strokeWidth,
      };
      ctx.store.update((current) => ({ ...addShape(current, shape), nextShapeNumber }));
      ctx.commit();
    },
    onCancel() {
      ctx.setLiveShape(null);
    },
  };
}

/**
 * Body-drag (move) gesture used by the select tool when the user
 * presses on an already-selected shape and drags. Translates the
 * shape by the per-frame delta; commits on pointerup. The caller
 * supplies the `translate` and `replace` closures so this stays
 * decoupled from the store-write specifics.
 */
export function startBodyMoveGesture(
  ctx: ToolGestureContext,
  origin: PointerEvent,
  shapeId: string,
  initialShape: Shape,
  translate: (shape: Shape, dx: number, dy: number) => Shape,
  replace: (shape: Shape) => void,
): DragHandlers {
  const startImage = ctx.toImageSpace(origin);
  ctx.store.update((current) => selectShape(current, shapeId));
  return {
    onMove(point) {
      const here = ctx.toImageSpace(point);
      const moved = translate(initialShape, here.x - startImage.x, here.y - startImage.y);
      replace(moved);
    },
    onCommit() {
      ctx.commit();
    },
    onCancel() {
      replace(initialShape);
    },
  };
}
