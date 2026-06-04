import type { ViewportController } from '@magicpages/kalotyp-core';

/**
 * Editor-level wheel + multi-pointer (pinch / two-finger pan) handler driving a `ViewportController`.
 *
 * - Wheel: zoom anchored at the cursor (1.0015 per `deltaY` unit).
 * - Two pointers: pinch + pan applied together each frame (no pinch-vs-pan state machine —
 *   applying both feels more natural and matches Snapseed / Apple Photos).
 * - Single pointer: pass-through to plugin gestures.
 */
export type StageGestureHandle = () => void;

const WHEEL_ZOOM_PER_DELTA = 1.0015;

interface PointerSample {
  readonly id: number;
  x: number;
  y: number;
}

interface ActiveGesture {
  lastDistance: number;
  lastMidpoint: { x: number; y: number };
}

export function attachStageGestures(
  stage: HTMLElement,
  controller: ViewportController,
): StageGestureHandle {
  const pointers = new Map<number, PointerSample>();
  let gesture: ActiveGesture | null = null;

  function stageRect(): DOMRect {
    return stage.getBoundingClientRect();
  }

  function clientToStage(clientX: number, clientY: number): { x: number; y: number } {
    const rect = stageRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function stageCenter(): { x: number; y: number } {
    const rect = stageRect();
    return { x: rect.width / 2, y: rect.height / 2 };
  }

  function snapshotMidpointAndDistance(): {
    midpoint: { x: number; y: number };
    distance: number;
  } | null {
    if (pointers.size < 2) return null;
    // With 3+ pointers (rare on phones, common on multi-touch trackpads), use the first two.
    const iter = pointers.values();
    const first = iter.next().value as PointerSample;
    const second = iter.next().value as PointerSample;
    const midpoint = clientToStage((first.x + second.x) / 2, (first.y + second.y) / 2);
    const dx = second.x - first.x;
    const dy = second.y - first.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return { midpoint, distance };
  }

  function startGestureIfPaired(): void {
    if (pointers.size < 2 || gesture !== null) return;
    const snap = snapshotMidpointAndDistance();
    if (!snap || snap.distance <= 0) return;
    gesture = { lastDistance: snap.distance, lastMidpoint: snap.midpoint };
    controller.setPinching(true);
  }

  function endGesture(): void {
    if (gesture === null) return;
    gesture = null;
    controller.setPinching(false);
  }

  function onPointerDown(event: PointerEvent): void {
    // No pointer-capture here — plugin handlers may own single-pointer drags. A second pointer
    // opportunistically promotes to a pinch/pan gesture, interrupting any in-flight plugin drag.
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pointers.set(event.pointerId, {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    });
    startGestureIfPaired();
  }

  function onPointerMove(event: PointerEvent): void {
    const tracked = pointers.get(event.pointerId);
    if (!tracked) return;
    tracked.x = event.clientX;
    tracked.y = event.clientY;
    if (gesture === null) return;
    const snap = snapshotMidpointAndDistance();
    if (!snap || snap.distance <= 0) return;

    // Pinch anchored at the midpoint so the gesture's center stays fixed.
    const zoomDelta = snap.distance / gesture.lastDistance;
    if (zoomDelta !== 1) {
      controller.zoomAt(zoomDelta, snap.midpoint, stageCenter());
    }

    const dx = snap.midpoint.x - gesture.lastMidpoint.x;
    const dy = snap.midpoint.y - gesture.lastMidpoint.y;
    if (dx !== 0 || dy !== 0) {
      controller.panBy(dx, dy);
    }

    gesture.lastDistance = snap.distance;
    gesture.lastMidpoint = snap.midpoint;

    event.preventDefault();
  }

  function onPointerUpOrCancel(event: PointerEvent): void {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    if (pointers.size < 2) endGesture();
  }

  function onWheel(event: WheelEvent): void {
    // ctrlKey + wheel on macOS trackpads = pinch; we want our zoom for both that and plain wheel.
    const factor = WHEEL_ZOOM_PER_DELTA ** -event.deltaY;
    if (factor === 1) return;
    const anchor = clientToStage(event.clientX, event.clientY);
    controller.zoomAt(factor, anchor, stageCenter());
    event.preventDefault();
  }

  // Listeners on bubble phase so plugin handlers see pointerdown first; we only intervene on the 2nd pointer.
  stage.addEventListener('pointerdown', onPointerDown);
  stage.addEventListener('pointermove', onPointerMove);
  stage.addEventListener('pointerup', onPointerUpOrCancel);
  stage.addEventListener('pointercancel', onPointerUpOrCancel);
  stage.addEventListener('pointerleave', onPointerUpOrCancel);
  // { passive: false } required: Chromium/WebKit treat wheel as passive by default, blocking preventDefault.
  stage.addEventListener('wheel', onWheel, { passive: false });

  return () => {
    stage.removeEventListener('pointerdown', onPointerDown);
    stage.removeEventListener('pointermove', onPointerMove);
    stage.removeEventListener('pointerup', onPointerUpOrCancel);
    stage.removeEventListener('pointercancel', onPointerUpOrCancel);
    stage.removeEventListener('pointerleave', onPointerUpOrCancel);
    stage.removeEventListener('wheel', onWheel);
    pointers.clear();
    if (gesture !== null) controller.setPinching(false);
    gesture = null;
  };
}
