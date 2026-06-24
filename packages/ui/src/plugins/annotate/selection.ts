/**
 * Selection rendering and per-handle resize gesture for annotation
 * shapes. The selection layer is responsible for:
 *
 *  - Rendering the bounding-box outline + 8 corner/edge handles when
 *    a shape is selected. Arrows render with two endpoint handles
 *    instead (no orthogonal extent to resize).
 *  - Wiring each handle's pointerdown to a per-handle resize gesture
 *    that mutates the shape's geometry as the user drags.
 *  - Cleaning up handles when the selection clears.
 *
 * Handles are positioned in stage CSS pixels using the shared
 * `position-handles` helper that crop already uses for its 8
 * manipulators. Reusing that helper keeps the handle DOM consistent
 * with crop's so future styling can target both with a single rule.
 */

import {
  ALL_SELECTION_HANDLES,
  type AnnotateState,
  type ArrowShape,
  boundingBoxOf,
  EMOJI_MIN_SIZE,
  normalizeAngle,
  type Rect,
  rectFromHandleDrag,
  replaceShape,
  type SelectionHandle,
  type Shape,
  selectionHandlePositions,
  type Viewport,
} from '@magicpages/kalotyp-core';
import type { DragHandlers } from './pointer-drag.js';
import { attachPointerDrag } from './pointer-drag.js';
import type { ToolGestureContext } from './tools.js';

/** Corner handles shown for emoji stickers (they resize uniformly — no edges). */
const EMOJI_CORNER_HANDLES: ReadonlyArray<SelectionHandle> = ['tl', 'tr', 'bl', 'br'];
/** Distance (display px) the rotate handle sits beyond the box's top edge. */
const ROTATE_HANDLE_OFFSET = 24;

/**
 * Build and own the selection-handle DOM. The returned object exposes
 * `update(shape, viewport)` so the caller can re-render handles after
 * any state change without rebuilding the DOM.
 */
export interface SelectionLayerOptions {
  readonly host: HTMLDivElement;
  readonly stageElement: HTMLElement;
  readonly toolContext: ToolGestureContext;
  /** Read the current letterbox viewport at gesture-start time. */
  getViewport(): Viewport;
}

export interface SelectionLayer {
  /** Update the rendered handles to reflect the selected shape (or clear). */
  update(shape: Shape | null, viewport: Viewport): void;
  destroy(): void;
}

export function buildSelectionLayer(options: SelectionLayerOptions): SelectionLayer {
  const { host, toolContext } = options;
  const handleEls = new Map<SelectionHandle, HTMLButtonElement>();
  const cleanups: Array<() => void> = [];

  // Eight box handles: only some are shown for non-rectangular shapes
  // (arrow uses just two endpoint handles).
  for (const direction of ALL_SELECTION_HANDLES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'kalotyp-annotate-handle';
    button.dataset.direction = direction;
    button.setAttribute('aria-label', handleLabel(direction));
    // The handles are pointer-driven affordances. Keyboard users
    // resize via the coordinate inputs (Phase 6.3), which
    // expose every dimension the eight handles do without forcing
    // the user to Tab through eight stops per selection. Removing
    // the handles from the keyboard tab order keeps the Tab-walk
    // through the editor short and meaningful — every stop the user
    // lands on does something via keyboard.
    //
    // We keep `aria-label` so the accessibility tree carries a
    // meaningful name (axe rule "button-name") and assistive tools
    // that navigate by something other than Tab still see a label.
    // We don't add `aria-hidden` here because a focusable element
    // (even with tabIndex=-1, since it's still programmatically
    // focusable) inside an aria-hidden subtree trips axe rule
    // "aria-hidden-focus".
    button.tabIndex = -1;
    button.style.display = 'none';
    handleEls.set(direction, button);
    host.appendChild(button);

    cleanups.push(
      attachPointerDrag(button, (event) => startHandleResizeGesture(toolContext, direction, event)),
    );
  }

  // Dedicated rotate handle for emoji stickers — orbits above the box.
  const rotateHandle = document.createElement('button');
  rotateHandle.type = 'button';
  rotateHandle.className = 'kalotyp-annotate-rotate-handle';
  rotateHandle.setAttribute('aria-label', 'Rotate');
  rotateHandle.tabIndex = -1;
  rotateHandle.style.display = 'none';
  host.appendChild(rotateHandle);
  cleanups.push(attachPointerDrag(rotateHandle, (event) => startRotateGesture(toolContext, event)));

  function update(shape: Shape | null, viewport: Viewport): void {
    // The rotate handle is emoji-only; hide it unless an emoji branch re-shows it.
    rotateHandle.style.display = 'none';
    if (!shape) {
      hideAll(handleEls);
      return;
    }
    if (shape.kind === 'arrow') {
      // Arrows only get two handles, mapped to their endpoints.
      hideAll(handleEls);
      const tl = handleEls.get('tl');
      const br = handleEls.get('br');
      if (tl) {
        positionHandle(tl, imageToDisplay({ x: shape.x1, y: shape.y1 }, viewport));
      }
      if (br) {
        positionHandle(br, imageToDisplay({ x: shape.x2, y: shape.y2 }, viewport));
      }
      return;
    }
    if (shape.kind === 'text') {
      // Text isn't handle-resizable — its size is set in the panel (font size),
      // not by dragging. The selection outline (drawn by CSS via the host)
      // still shows what's selected, and a body drag still moves it. Hide all
      // resize handles so there's just one box, not a handle frame too.
      hideAll(handleEls);
      return;
    }
    if (shape.kind === 'emoji') {
      // Emoji stickers scale uniformly, so only the four corner handles show.
      hideAll(handleEls);
      const positions = selectionHandlePositions(boundingBoxOf(shape));
      for (const direction of EMOJI_CORNER_HANDLES) {
        const handle = handleEls.get(direction);
        if (handle) positionHandle(handle, imageToDisplay(positions[direction], viewport));
      }
      // Rotate handle orbits above the box at the sticker's current angle.
      const center = imageToDisplay(
        { x: shape.x + shape.size / 2, y: shape.y + shape.size / 2 },
        viewport,
      );
      const radius = (shape.size / 2) * viewport.scale + ROTATE_HANDLE_OFFSET;
      const theta = (shape.rotation * Math.PI) / 180;
      positionHandle(rotateHandle, {
        x: center.x + radius * Math.sin(theta),
        y: center.y - radius * Math.cos(theta),
      });
      return;
    }
    const box = boundingBoxOf(shape);
    const handlePositions = selectionHandlePositions(box);
    for (const direction of ALL_SELECTION_HANDLES) {
      const handle = handleEls.get(direction);
      if (!handle) continue;
      positionHandle(handle, imageToDisplay(handlePositions[direction], viewport));
    }
  }

  function destroy(): void {
    for (const cleanup of cleanups) cleanup();
    for (const [, button] of handleEls) button.remove();
    handleEls.clear();
    rotateHandle.remove();
  }

  return { update, destroy };
}

function imageToDisplay(
  point: { x: number; y: number },
  viewport: Viewport,
): { x: number; y: number } {
  return {
    x: viewport.displayRect.x + point.x * viewport.scale,
    y: viewport.displayRect.y + point.y * viewport.scale,
  };
}

function positionHandle(handle: HTMLButtonElement, displayPoint: { x: number; y: number }): void {
  handle.style.display = '';
  handle.style.left = `${displayPoint.x}px`;
  handle.style.top = `${displayPoint.y}px`;
}

function hideAll(handles: Map<SelectionHandle, HTMLButtonElement>): void {
  for (const [, button] of handles) {
    button.style.display = 'none';
  }
}

/**
 * Build the per-handle resize gesture. Snapshots the selected shape
 * at gesture start; each move computes the new image-space pointer
 * position and applies it via the appropriate per-shape mutator.
 *
 * Returns `null` if no shape is selected when the handle is pressed
 * (defensive — UI should hide handles in that case).
 */
/**
 * The rotation (degrees, CW) that aims the box's "up" edge toward `pointer`,
 * about the box `center`. Pointer directly above the centre → 0°. Exported so
 * the angle math can be unit-tested without a live gesture.
 */
export function emojiRotationFromPointer(
  center: { x: number; y: number },
  pointer: { x: number; y: number },
): number {
  const deg = (Math.atan2(pointer.y - center.y, pointer.x - center.x) * 180) / Math.PI + 90;
  return normalizeAngle(deg);
}

/**
 * Drag-to-rotate gesture for the emoji rotate handle. Rotates about the box
 * centre; holding Shift snaps to 15° increments. Returns `null` if the selected
 * shape isn't an emoji (defensive — the handle only shows for emoji).
 */
function startRotateGesture(ctx: ToolGestureContext, origin: PointerEvent): DragHandlers | null {
  const state = ctx.store.get();
  const selected = state.shapes.find((shape) => shape.id === state.selectedId);
  if (selected?.kind !== 'emoji') return null;
  const initial = selected;
  const center = { x: initial.x + initial.size / 2, y: initial.y + initial.size / 2 };
  void origin;
  return {
    onMove(point) {
      let rotation = emojiRotationFromPointer(center, ctx.toImageSpace(point));
      if (point.shiftKey) rotation = normalizeAngle(Math.round(rotation / 15) * 15);
      ctx.store.update((cur) => replaceShape(cur, { ...initial, rotation: Math.round(rotation) }));
    },
    onCommit() {
      ctx.commit();
    },
    onCancel() {
      ctx.store.update((cur) => replaceShape(cur, initial));
    },
  };
}

function startHandleResizeGesture(
  ctx: ToolGestureContext,
  direction: SelectionHandle,
  origin: PointerEvent,
): DragHandlers | null {
  const state = ctx.store.get();
  const selected = state.shapes.find((shape) => shape.id === state.selectedId);
  if (!selected) return null;
  const initial = selected;

  // `origin` is part of the gesture signature even though we read all
  // needed state from the store at gesture start. It carries pointerId
  // / button info the pointer-drag helper consumes.
  void origin;
  return {
    onMove(point) {
      const image = ctx.toImageSpace(point);
      const next = applyHandleDrag(initial, direction, image);
      if (next) ctx.store.update((cur) => replaceShape(cur, next));
    },
    onCommit() {
      ctx.commit();
    },
    onCancel() {
      ctx.store.update((cur) => replaceShape(cur, initial));
    },
  };
}

/**
 * Map a handle drag to a new shape. Exported for unit testing; the gesture
 * wrapper calls it on each pointer move.
 */
export function applyHandleDrag(
  shape: Shape,
  direction: SelectionHandle,
  image: { x: number; y: number },
): Shape | null {
  switch (shape.kind) {
    case 'rect':
    case 'ellipse': {
      const box: Rect = {
        x: shape.x,
        y: shape.y,
        width: shape.width,
        height: shape.height,
      };
      const next = rectFromHandleDrag(box, direction, image);
      // We allow negative width/height during the drag; the next
      // commit normalises. Keeping it un-normalised mid-drag makes
      // the live preview match what the user is doing on screen.
      return { ...shape, x: next.x, y: next.y, width: next.width, height: next.height };
    }
    case 'arrow': {
      const arrow = shape as ArrowShape;
      // 'tl' handle maps to (x1,y1); 'br' maps to (x2,y2). The
      // selection layer hides the other six handles for arrows.
      if (direction === 'tl') return { ...arrow, x1: image.x, y1: image.y };
      if (direction === 'br') return { ...arrow, x2: image.x, y2: image.y };
      return shape;
    }
    case 'text':
      // Text isn't handle-resizable (its size is the panel's font-size
      // control). The selection layer hides text handles, so this is
      // unreachable; return unchanged for exhaustiveness.
      return shape;
    case 'emoji': {
      // Uniform square resize: the corner opposite the dragged handle stays
      // anchored, and the box edge follows the larger pointer-axis delta so it
      // never distorts. Only corners are shown; edge handles no-op.
      const corner =
        direction === 'tl' || direction === 'tr' || direction === 'bl' || direction === 'br';
      if (!corner) return shape;
      const { x, y, size } = shape;
      const right = x + size;
      const bottom = y + size;
      const anchorRight = direction === 'tl' || direction === 'bl';
      const anchorBottom = direction === 'tl' || direction === 'tr';
      const dx = anchorRight ? right - image.x : image.x - x;
      const dy = anchorBottom ? bottom - image.y : image.y - y;
      const nextSize = Math.max(EMOJI_MIN_SIZE, Math.round(Math.max(dx, dy)));
      const nextX = anchorRight ? right - nextSize : x;
      const nextY = anchorBottom ? bottom - nextSize : y;
      return { ...shape, x: nextX, y: nextY, size: nextSize };
    }
    case 'freehand':
    case 'highlight': {
      // Path shapes scale around their bounding-box centre by the
      // ratio between the initial and dragged box. Move the dragged
      // corner to the pointer; the other corners scale accordingly.
      const box = boundingBoxOf(shape);
      if (box.width === 0 || box.height === 0) return shape;
      const next = rectFromHandleDrag(box, direction, image);
      const scaleX = next.width / box.width;
      const scaleY = next.height / box.height;
      if (!Number.isFinite(scaleX) || !Number.isFinite(scaleY)) return shape;
      const points = shape.points.map((p) => ({
        x: next.x + (p.x - box.x) * scaleX,
        y: next.y + (p.y - box.y) * scaleY,
      }));
      return { ...shape, points };
    }
  }
}

function handleLabel(direction: SelectionHandle): string {
  switch (direction) {
    case 'tl':
      return 'Resize from top-left';
    case 'tr':
      return 'Resize from top-right';
    case 'bl':
      return 'Resize from bottom-left';
    case 'br':
      return 'Resize from bottom-right';
    case 't':
      return 'Resize from top';
    case 'r':
      return 'Resize from right';
    case 'b':
      return 'Resize from bottom';
    case 'l':
      return 'Resize from left';
  }
}

/**
 * Helper for the mount layer: which shape (if any) is selected, given
 * the current state? Keeps the lookup logic in one place — most
 * callers in `mount.ts` need it via the store subscription.
 */
export function selectedShapeOf(state: AnnotateState): Shape | null {
  if (state.selectedId === null) return null;
  return state.shapes.find((shape) => shape.id === state.selectedId) ?? null;
}
