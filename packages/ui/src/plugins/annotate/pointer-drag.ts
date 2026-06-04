/**
 * Pointer-drag helper. Same shape as the crop plugin's
 * `attachPointerDrag` (interaction.ts), kept local here so the
 * annotation tool gestures can layer their own per-gesture state on
 * top without coupling to the crop module.
 *
 * The factory is invoked on `pointerdown`. It must return a
 * `DragHandlers` object whose three callbacks describe the gesture's
 * lifecycle: `onMove(point)` per coalesced animation frame,
 * `onCommit()` once on `pointerup` (after a final drained move), and
 * `onCancel()` once on `pointercancel`.
 *
 * The factory may return `null` to refuse the gesture — useful when
 * a hit-area pointerdown only sometimes starts a drag (e.g. the
 * select tool doesn't drag if no shape is under the pointer).
 */

/**
 * Per-frame point payload. Includes `shiftKey` so tool gestures can
 * apply axis / square / circle constraints while the modifier is
 * held — the standard image-editor convention (Figma, Sketch,
 * Photoshop). The flag reflects shift-state at the most
 * recent pointer event, so releasing/re-pressing shift mid-drag
 * toggles the constraint live.
 */
export interface DragPoint {
  readonly clientX: number;
  readonly clientY: number;
  readonly shiftKey: boolean;
}

export interface DragHandlers {
  onMove(point: DragPoint): void;
  onCommit(): void;
  onCancel(): void;
}

export function attachPointerDrag(
  element: HTMLElement,
  factory: (start: PointerEvent) => DragHandlers | null,
): () => void {
  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    const handlers = factory(event);
    if (!handlers) return;
    event.preventDefault();
    event.stopPropagation();

    try {
      element.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic events (test runners, accessibility tools) sometimes
      // present a pointer id the browser can't resolve. Move/up events
      // still flow through the listeners we attach below; capture is a
      // best-effort affordance for OS-level cross-element drag.
    }

    let pendingPoint: DragPoint | undefined;
    let rafScheduled = false;
    // Track the latest shift state so a key-up/key-down between
    // pointer moves still flushes a frame with the new constraint.
    let lastShiftKey = event.shiftKey;

    const flush = (): void => {
      rafScheduled = false;
      if (!pendingPoint) return;
      const point = pendingPoint;
      pendingPoint = undefined;
      handlers.onMove(point);
    };

    const schedule = (point: DragPoint): void => {
      pendingPoint = point;
      if (!rafScheduled) {
        rafScheduled = true;
        requestAnimationFrame(flush);
      }
    };

    const onPointerMove = (moveEvent: PointerEvent): void => {
      if (moveEvent.pointerId !== event.pointerId) return;
      lastShiftKey = moveEvent.shiftKey;
      schedule({
        clientX: moveEvent.clientX,
        clientY: moveEvent.clientY,
        shiftKey: moveEvent.shiftKey,
      });
    };

    // Re-apply the gesture with the new constraint when the user
    // toggles shift mid-drag without moving the pointer.
    const onKeyToggle = (keyEvent: KeyboardEvent): void => {
      if (keyEvent.key !== 'Shift') return;
      if (keyEvent.shiftKey === lastShiftKey) return;
      lastShiftKey = keyEvent.shiftKey;
      // Use the last committed/pending pointer position; if neither
      // exists yet (no pointermove since pointerdown), use the
      // pointerdown coords.
      const last = pendingPoint;
      const x = last?.clientX ?? event.clientX;
      const y = last?.clientY ?? event.clientY;
      schedule({ clientX: x, clientY: y, shiftKey: keyEvent.shiftKey });
    };

    const finish = (committed: boolean): void => {
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('pointerup', onPointerUp);
      element.removeEventListener('pointercancel', onPointerCancel);
      window.removeEventListener('keydown', onKeyToggle);
      window.removeEventListener('keyup', onKeyToggle);
      try {
        element.releasePointerCapture(event.pointerId);
      } catch {
        // Already released or never captured; nothing to do.
      }
      if (pendingPoint) {
        const final = pendingPoint;
        pendingPoint = undefined;
        handlers.onMove(final);
      }
      if (committed) handlers.onCommit();
      else handlers.onCancel();
    };

    const onPointerUp = (upEvent: PointerEvent): void => {
      if (upEvent.pointerId !== event.pointerId) return;
      finish(true);
    };
    const onPointerCancel = (cancelEvent: PointerEvent): void => {
      if (cancelEvent.pointerId !== event.pointerId) return;
      finish(false);
    };

    element.addEventListener('pointermove', onPointerMove);
    element.addEventListener('pointerup', onPointerUp);
    element.addEventListener('pointercancel', onPointerCancel);
    window.addEventListener('keydown', onKeyToggle);
    window.addEventListener('keyup', onKeyToggle);
  };

  element.addEventListener('pointerdown', onPointerDown);
  return () => element.removeEventListener('pointerdown', onPointerDown);
}

/** Convert a client-space point to the bounding-rect-local coords of `element`. */
export function clientToElement(
  element: HTMLElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const rect = element.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}
