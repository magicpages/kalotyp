import {
  type CropState,
  type HandleDirection,
  type Rect,
  type Store,
  type Viewport,
  pointDisplayToImage,
  resizeRectFromHandle,
  translateClampedRect,
} from '@magicpages/kalotyp-core';

export interface CropInteractionElements {
  readonly stageElement: HTMLElement;
  readonly handles: Readonly<Record<HandleDirection, HTMLElement>>;
  readonly bodyHitArea: HTMLElement;
}

export interface CropInteractionContext {
  getViewport(): Viewport;
  /** Called once on pointerup so editor history can snapshot. Optional for tests. */
  onCommit?: () => void;
}

export interface CropInteractionHandle {
  destroy(): void;
}

/** Wire eight-handle resize + body translate onto the crop rect. Per-frame rAF-coalesced. */
export function bindCropInteractions(
  elements: CropInteractionElements,
  store: Store<CropState>,
  ctx: CropInteractionContext,
): CropInteractionHandle {
  const cleanups: Array<() => void> = [];

  for (const direction of Object.keys(elements.handles) as HandleDirection[]) {
    const handle = elements.handles[direction];
    cleanups.push(attachResizeGesture(handle, direction, store, ctx));
  }
  cleanups.push(attachTranslateGesture(elements.bodyHitArea, store, ctx));

  return {
    destroy() {
      for (const cleanup of cleanups) cleanup();
    },
  };
}

function attachResizeGesture(
  element: HTMLElement,
  direction: HandleDirection,
  store: Store<CropState>,
  ctx: CropInteractionContext,
): () => void {
  return attachPointerDrag(element, () => {
    const viewport = ctx.getViewport();
    const initial = store.get();
    const bounds: Rect = {
      x: 0,
      y: 0,
      width: initial.imageSize.width,
      height: initial.imageSize.height,
    };
    const aspectRatio = initial.aspectRatio;

    return {
      onMove(point) {
        const stagePoint = clientToStage(element, point.clientX, point.clientY);
        const imagePoint = pointDisplayToImage(stagePoint, viewport);
        const next = resizeRectFromHandle(initial.rect, direction, imagePoint, {
          bounds,
          ...(aspectRatio !== undefined ? { aspectRatio } : {}),
        });
        store.set({ rect: next });
      },
      onCommit() {
        ctx.onCommit?.();
      },
      onCancel() {
        store.set({ rect: initial.rect });
      },
    };
  });
}

function attachTranslateGesture(
  element: HTMLElement,
  store: Store<CropState>,
  ctx: CropInteractionContext,
): () => void {
  return attachPointerDrag(element, (event) => {
    const viewport = ctx.getViewport();
    const initial = store.get();
    const bounds: Rect = {
      x: 0,
      y: 0,
      width: initial.imageSize.width,
      height: initial.imageSize.height,
    };
    const originStage = clientToStage(element, event.clientX, event.clientY);

    return {
      onMove(point) {
        const here = clientToStage(element, point.clientX, point.clientY);
        const dxImage = (here.x - originStage.x) / viewport.scale;
        const dyImage = (here.y - originStage.y) / viewport.scale;
        const next = translateClampedRect(initial.rect, dxImage, dyImage, bounds);
        store.set({ rect: next });
      },
      onCommit() {
        ctx.onCommit?.();
      },
      onCancel() {
        store.set({ rect: initial.rect });
      },
    };
  });
}

interface DragHandlers {
  onMove(point: { clientX: number; clientY: number }): void;
  onCommit(): void;
  onCancel(): void;
}

/** rAF-coalesced pointer-drag attach. Factory runs on pointerdown. */
function attachPointerDrag(
  element: HTMLElement,
  factory: (start: PointerEvent) => DragHandlers,
): () => void {
  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    const handlers = factory(event);
    element.setPointerCapture(event.pointerId);

    let pendingPoint: { clientX: number; clientY: number } | undefined;
    let rafScheduled = false;

    const flush = (): void => {
      rafScheduled = false;
      if (!pendingPoint) return;
      const point = pendingPoint;
      pendingPoint = undefined;
      handlers.onMove(point);
    };

    const onPointerMove = (moveEvent: PointerEvent): void => {
      if (moveEvent.pointerId !== event.pointerId) return;
      pendingPoint = { clientX: moveEvent.clientX, clientY: moveEvent.clientY };
      if (!rafScheduled) {
        rafScheduled = true;
        requestAnimationFrame(flush);
      }
    };

    const finish = (committed: boolean): void => {
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('pointerup', onPointerUp);
      element.removeEventListener('pointercancel', onPointerCancel);
      try {
        element.releasePointerCapture(event.pointerId);
      } catch {
        // already released or never captured
      }
      // Drain pending frame so the final point lands.
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
  };

  element.addEventListener('pointerdown', onPointerDown);
  return () => element.removeEventListener('pointerdown', onPointerDown);
}

function clientToStage(
  element: HTMLElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  // Walk up to the stage container so coords are stage-relative regardless of handle nesting.
  const stage = element.closest<HTMLElement>('.kalotyp-stage-container') ?? element;
  const rect = stage.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}
