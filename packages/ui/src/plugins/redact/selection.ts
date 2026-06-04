/**
 * Selection rendering and per-handle resize gesture for redaction
 * regions. The annotate plugin's `selection.ts` does the same job for
 * shapes; the redact version is simpler because there's only one
 * shape kind (rectangle), so we can wire the corner/edge handles
 * directly to a rect-resize without a per-kind dispatch.
 */

import {
  ALL_SELECTION_HANDLES,
  type Rect,
  type RedactRegion,
  type RedactState,
  rectFromHandleDrag,
  replaceRedactRegion,
  type SelectionHandle,
  type Store,
  selectedRedactRegionOf,
  type Viewport,
} from '@magicpages/kalotyp-core';
import type { DragHandlers } from '../annotate/pointer-drag.js';
import { attachPointerDrag } from '../annotate/pointer-drag.js';

export interface RedactSelectionLayerOptions {
  readonly host: HTMLDivElement;
  readonly store: Store<RedactState>;
  /** Project a raw client-space pointer to image-space pixels. */
  toImageSpace(point: { clientX: number; clientY: number }): { x: number; y: number };
  /** Read the current viewport at gesture start. */
  getViewport(): Viewport;
  /** Emit a history-commit at gesture end. */
  commit(): void;
}

export interface RedactSelectionLayer {
  update(region: RedactRegion | null, viewport: Viewport): void;
  destroy(): void;
}

export function buildRedactSelectionLayer(
  options: RedactSelectionLayerOptions,
): RedactSelectionLayer {
  const { host, store } = options;
  const handleEls = new Map<SelectionHandle, HTMLButtonElement>();
  const cleanups: Array<() => void> = [];

  for (const direction of ALL_SELECTION_HANDLES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'kalotyp-redact-handle';
    button.dataset.direction = direction;
    button.setAttribute('aria-label', handleLabel(direction));
    // Same a11y rationale as the annotate plugin: handles are
    // pointer-driven; keyboard users use the coordinate inputs.
    // Exclude from tab order to keep the Tab walk meaningful.
    button.tabIndex = -1;
    button.style.display = 'none';
    handleEls.set(direction, button);
    host.appendChild(button);

    cleanups.push(attachPointerDrag(button, (event) => startHandleResizeGesture(direction, event)));
  }

  function update(region: RedactRegion | null, viewport: Viewport): void {
    if (!region) {
      for (const [, button] of handleEls) button.style.display = 'none';
      return;
    }
    const box: Rect = {
      x: region.x,
      y: region.y,
      width: region.width,
      height: region.height,
    };
    const positions = handlePositionsFor(box);
    for (const direction of ALL_SELECTION_HANDLES) {
      const handle = handleEls.get(direction);
      if (!handle) continue;
      const display = imageToDisplay(positions[direction], viewport);
      handle.style.display = '';
      handle.style.left = `${display.x}px`;
      handle.style.top = `${display.y}px`;
    }
  }

  function destroy(): void {
    for (const cleanup of cleanups) cleanup();
    for (const [, button] of handleEls) button.remove();
    handleEls.clear();
  }

  function startHandleResizeGesture(
    direction: SelectionHandle,
    origin: PointerEvent,
  ): DragHandlers | null {
    const initial = selectedRedactRegionOf(store.get());
    if (!initial) return null;
    void origin;
    return {
      onMove(point) {
        const image = options.toImageSpace(point);
        const box: Rect = {
          x: initial.x,
          y: initial.y,
          width: initial.width,
          height: initial.height,
        };
        const next = rectFromHandleDrag(box, direction, image);
        // Allow negative width/height during the drag (the live
        // preview matches the user's gesture); the commit step
        // normalises by sign-flipping. Rect coords go straight onto
        // the region so the regions canvas re-renders the new shape.
        store.update((current) =>
          replaceRedactRegion(current, {
            ...initial,
            x: next.x,
            y: next.y,
            width: next.width,
            height: next.height,
          }),
        );
      },
      onCommit() {
        // Normalise the rect's sign on commit. We re-read the store
        // because the active gesture may have left negative dims;
        // the bake assumes non-negative.
        const region = selectedRedactRegionOf(store.get());
        if (region && (region.width < 0 || region.height < 0)) {
          let { x, y, width, height } = region;
          if (width < 0) {
            x += width;
            width = -width;
          }
          if (height < 0) {
            y += height;
            height = -height;
          }
          store.update((current) =>
            replaceRedactRegion(current, { ...region, x, y, width, height }),
          );
        }
        options.commit();
      },
      onCancel() {
        store.update((current) => replaceRedactRegion(current, initial));
      },
    };
  }

  return { update, destroy };
}

function handlePositionsFor(rect: Rect): Record<SelectionHandle, { x: number; y: number }> {
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

function imageToDisplay(
  point: { x: number; y: number },
  viewport: Viewport,
): { x: number; y: number } {
  return {
    x: viewport.displayRect.x + point.x * viewport.scale,
    y: viewport.displayRect.y + point.y * viewport.scale,
  };
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
