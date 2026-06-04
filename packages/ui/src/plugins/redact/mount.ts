/**
 * Mount the redact plugin's stage UI and wire up:
 *   - the layered canvases (image / regions / live);
 *   - the bottom panel (mode toolbar, colour picker, insert/delete);
 *   - pointer drag-to-define for new regions;
 *   - the selection layer (corner handles + per-handle resize);
 *   - the per-region coordinate inputs (Phase 6.4 keyboard a11y);
 *   - keyboard shortcuts (Delete/Backspace removes selection; Esc
 *     deselects; arrow keys nudge the selected region);
 * - revalidation against upstream-bounds changes.
 */

import {
  addRegion,
  computeViewport,
  createCenteredRedactRegion,
  deleteRedactRegion,
  mintRegionId,
  normaliseRedactExtent,
  type Point,
  pointDisplayToImage,
  type RedactMode,
  type RedactRegion,
  type RedactState,
  replaceRedactRegion,
  revalidateRedactAgainstBounds,
  type SourceImage,
  type Store,
  selectedRedactRegionOf,
  selectRedactRegion,
  setRedactCurrentColor,
  setRedactCurrentMode,
  setRedactRegionColor,
  setRedactRegionMode,
  type Viewport,
  type ViewportController,
} from '@magicpages/kalotyp-core';
import { attachPointerDrag, clientToElement, type DragHandlers } from '../annotate/pointer-drag.js';
import { buildRedactCoordInputs } from './coord-inputs.js';
import { buildRedactPanel, type RedactPanel } from './panel.js';
import { paintRedactImageLayer, paintRedactLiveLayer, paintRedactRegionsLayer } from './render.js';
import { buildRedactSelectionLayer } from './selection.js';
import { buildRedactStage } from './stage.js';

const STAGE_PADDING_PX = 32;

export interface MountRedactOptions {
  readonly stageHost: HTMLElement;
  readonly utilHost: HTMLElement;
  readonly source: SourceImage;
  readonly store: Store<RedactState>;
  readonly viewport?: ViewportController;
  readonly onCommit?: () => void;
  readonly onAnnounce?: (message: string) => void;
}

export interface MountRedactHandle {
  destroy(): void;
}

export function mountRedactUtility(options: MountRedactOptions): MountRedactHandle {
  const { stageHost, utilHost, source, store, viewport: controller } = options;
  const commit = options.onCommit ?? (() => {});
  const announce = options.onAnnounce ?? (() => {});

  // First, revalidate against the upstream source's dimensions —
  // entering redact after a re-crop may bring outdated regions.
  const revalidated = revalidateRedactAgainstBounds(store.get(), {
    width: source.width,
    height: source.height,
  });
  if (revalidated !== store.get()) {
    store.update(() => revalidated);
  }

  const stage = buildRedactStage();
  stageHost.appendChild(stage.container);

  let viewport: Viewport = computeViewport(
    { width: 1, height: 1, padding: STAGE_PADDING_PX },
    { width: source.width, height: source.height },
  );
  let liveMarquee: {
    x: number;
    y: number;
    width: number;
    height: number;
    mode: RedactMode;
    color: string;
  } | null = null;

  function recomputeViewport(): void {
    const rect = stage.container.getBoundingClientRect();
    const stageDims = { width: rect.width, height: rect.height, padding: STAGE_PADDING_PX };
    const imageSize = { width: source.width, height: source.height };
    viewport = controller
      ? controller.computeViewport(stageDims, imageSize)
      : computeViewport(stageDims, imageSize);
  }

  function paintImage(): void {
    const rect = stage.container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    paintRedactImageLayer(stage.imageCanvas, source, rect.width, rect.height, viewport);
  }

  function paintRegions(): void {
    const rect = stage.container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const state = store.get();
    paintRedactRegionsLayer(
      stage.regionsCanvas,
      source,
      state.regions,
      state.selectedId,
      rect.width,
      rect.height,
      viewport,
    );
  }

  function paintLive(): void {
    const rect = stage.container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    paintRedactLiveLayer(stage.liveCanvas, liveMarquee, rect.width, rect.height, viewport);
  }

  function paintAll(): void {
    paintImage();
    paintRegions();
    paintLive();
    selectionLayer.update(selectedRedactRegionOf(store.get()), viewport);
  }

  function setLiveMarquee(
    next: {
      x: number;
      y: number;
      width: number;
      height: number;
      mode: RedactMode;
      color: string;
    } | null,
  ): void {
    liveMarquee = next;
    paintLive();
  }

  function toImageSpace(point: { clientX: number; clientY: number }): Point {
    const stagePoint = clientToElement(stage.container, point.clientX, point.clientY);
    return pointDisplayToImage(stagePoint, viewport);
  }

  // ----- Selection layer (handles + per-handle resize) -----
  const selectionLayer = buildRedactSelectionLayer({
    host: stage.handlesLayer,
    store,
    toImageSpace,
    getViewport: () => viewport,
    commit,
  });

  // ----- Pointer dispatch on the hit area -----
  const removeHitDrag = attachPointerDrag(stage.hitArea, (event) => {
    const state = store.get();
    // First: did the click land on an existing region? If so, select
    // it and start a body-move drag. Otherwise, drag-to-create.
    const image = toImageSpace(event);
    const hit = pickRegion(state.regions, image);
    if (hit) {
      if (state.selectedId !== hit.id) {
        store.update((current) => selectRedactRegion(current, hit.id));
      }
      return startBodyMoveGesture(hit, event);
    }
    return startCreateGesture(state, event);
  });

  function startBodyMoveGesture(initial: RedactRegion, event: PointerEvent): DragHandlers {
    const startImage = toImageSpace(event);
    return {
      onMove(point) {
        const here = toImageSpace(point);
        const dx = here.x - startImage.x;
        const dy = here.y - startImage.y;
        store.update((current) =>
          replaceRedactRegion(current, {
            ...initial,
            x: initial.x + dx,
            y: initial.y + dy,
          }),
        );
      },
      onCommit() {
        commit();
      },
      onCancel() {
        store.update((current) => replaceRedactRegion(current, initial));
      },
    };
  }

  function startCreateGesture(state: RedactState, event: PointerEvent): DragHandlers {
    const startImage = toImageSpace(event);
    let lastImage = startImage;
    return {
      onMove(point) {
        const raw = toImageSpace(point);
        // Shift constrains to a square — same convention the annotate
        // plugin uses for rect/ellipse drag-to-create.
        if (point.shiftKey) {
          const dx = raw.x - startImage.x;
          const dy = raw.y - startImage.y;
          const size = Math.max(Math.abs(dx), Math.abs(dy));
          const sx = dx === 0 ? 1 : Math.sign(dx);
          const sy = dy === 0 ? 1 : Math.sign(dy);
          lastImage = { x: startImage.x + sx * size, y: startImage.y + sy * size };
        } else {
          lastImage = raw;
        }
        setLiveMarquee({
          x: startImage.x,
          y: startImage.y,
          width: lastImage.x - startImage.x,
          height: lastImage.y - startImage.y,
          mode: state.currentMode,
          color: state.currentColor,
        });
      },
      onCommit() {
        setLiveMarquee(null);
        const extent = normaliseRedactExtent({
          x: startImage.x,
          y: startImage.y,
          width: lastImage.x - startImage.x,
          height: lastImage.y - startImage.y,
        });
        // Drop zero-extent gestures (a click that didn't drag).
        if (extent.width < 4 || extent.height < 4) return;
        const { id, nextRegionNumber } = mintRegionId(state);
        const region: RedactRegion = {
          id,
          x: extent.x,
          y: extent.y,
          width: extent.width,
          height: extent.height,
          mode: state.currentMode,
          color: state.currentColor,
        };
        store.update((current) => ({ ...addRegion(current, region), nextRegionNumber }));
        commit();
      },
      onCancel() {
        setLiveMarquee(null);
      },
    };
  }

  function insertDefaultAtCenter(): void {
    const state = store.get();
    const { id, nextRegionNumber } = mintRegionId(state);
    const region = createCenteredRedactRegion({
      imageSize: { width: source.width, height: source.height },
      mode: state.currentMode,
      color: state.currentColor,
      id,
    });
    store.update((current) => ({ ...addRegion(current, region), nextRegionNumber }));
    announce(
      'Redaction region placed at centre. Use arrow keys to nudge, or edit coordinates below.',
    );
    requestAnimationFrame(() => {
      const firstInput = coordInputs.container.querySelector<HTMLInputElement>(
        '.kalotyp-redact-coords-input',
      );
      firstInput?.focus();
      firstInput?.select();
    });
    commit();
  }

  // ----- Coordinate inputs (keyboard a11y) -----
  const coordInputs = buildRedactCoordInputs({
    onRegionChanged: (region) => {
      store.update((current) => replaceRedactRegion(current, region));
      commit();
    },
  });

  // ----- Panel -----
  const initialState = store.get();
  const panel: RedactPanel = buildRedactPanel({
    initialMode: initialState.currentMode,
    initialColor: initialState.currentColor,
    canDelete: initialState.selectedId !== null,
    coordInputs: coordInputs.container,
    onSelectMode: (mode) => {
      // Mode toggle does double duty: set the mode for new regions
      // *and* update the selected region's mode if one is selected
      // (Phase 6.4 brief — "mode change on selected region").
      store.update((current) => {
        const next = setRedactCurrentMode(current, mode);
        if (next.selectedId === null) return next;
        return setRedactRegionMode(next, next.selectedId, mode);
      });
      commit();
    },
    onColorChange: (color) => {
      store.update((current) => {
        const next = setRedactCurrentColor(current, color);
        if (next.selectedId === null) return next;
        return setRedactRegionColor(next, next.selectedId, color);
      });
      commit();
    },
    onInsertAtCenter: () => insertDefaultAtCenter(),
    onDeleteSelected: () => {
      const id = store.get().selectedId;
      if (!id) return;
      store.update((current) => deleteRedactRegion(current, id));
      commit();
    },
  });
  utilHost.appendChild(panel.container);

  // ----- Initial paint + observers -----
  recomputeViewport();
  paintAll();

  const resizeObserver = new ResizeObserver(() => {
    recomputeViewport();
    paintAll();
  });
  resizeObserver.observe(stage.container);

  let viewportRafScheduled = false;
  const unsubscribeViewport = controller?.subscribe(() => {
    if (viewportRafScheduled) return;
    viewportRafScheduled = true;
    requestAnimationFrame(() => {
      viewportRafScheduled = false;
      recomputeViewport();
      paintAll();
    });
  });

  // Repaint regions and panel state on every store change. This is
  // identical to the annotate plugin's subscription rhythm; keeps a
  // pointer drag, a coordinate edit, an undo, and a panel toggle on
  // one consistent re-render path.
  let lastRegions = store.get().regions;
  let lastSelected = store.get().selectedId;
  let lastMode = store.get().currentMode;
  let lastColor = store.get().currentColor;

  const unsubscribe = store.subscribe((next) => {
    const regionsChanged = next.regions !== lastRegions;
    const selectionChanged = next.selectedId !== lastSelected;
    if (regionsChanged) {
      lastRegions = next.regions;
      paintRegions();
    }
    if (selectionChanged) {
      lastSelected = next.selectedId;
      panel.setCanDelete(next.selectedId !== null);
    }
    if (next.currentMode !== lastMode) {
      lastMode = next.currentMode;
      panel.setActiveMode(next.currentMode);
    }
    if (next.currentColor !== lastColor) {
      lastColor = next.currentColor;
      panel.setColor(next.currentColor);
    }
    selectionLayer.update(selectedRedactRegionOf(next), viewport);
    if (selectionChanged || regionsChanged) {
      // Sync the coordinate inputs to whichever region is now
      // selected; the inputs are a render of the selected region's
      // image-space coordinates.
      coordInputs.updateForRegion(selectedRedactRegionOf(next));
    }
  });

  // ----- Keyboard handlers -----
  const onKeyDown = (event: KeyboardEvent): void => {
    const target = event.target as Element | null;
    if (isEditableTarget(target)) return;
    const state = store.get();
    if (event.key === 'Escape') {
      if (state.selectedId !== null) {
        event.preventDefault();
        event.stopPropagation();
        store.update((current) => selectRedactRegion(current, null));
        announce('Selection cleared.');
      }
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (state.selectedId === null) return;
      event.preventDefault();
      const id = state.selectedId;
      store.update((current) => deleteRedactRegion(current, id));
      commit();
      return;
    }
    if (
      event.key === 'ArrowUp' ||
      event.key === 'ArrowDown' ||
      event.key === 'ArrowLeft' ||
      event.key === 'ArrowRight'
    ) {
      const selected = selectedRedactRegionOf(state);
      if (!selected) return;
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      const step = event.shiftKey ? 10 : 1;
      const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
      const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
      event.preventDefault();
      store.update((current) =>
        replaceRedactRegion(current, {
          ...selected,
          x: selected.x + dx,
          y: selected.y + dy,
        }),
      );
      commit();
    }
  };
  document.addEventListener('keydown', onKeyDown, true);

  return {
    destroy() {
      document.removeEventListener('keydown', onKeyDown, true);
      removeHitDrag();
      unsubscribe();
      unsubscribeViewport?.();
      resizeObserver.disconnect();
      coordInputs.destroy();
      selectionLayer.destroy();
      stage.container.remove();
      panel.container.remove();
    },
  };
}

/**
 * Topmost (last-drawn) region containing the supplied image-space
 * point. Returns `undefined` when no region matches. Same pattern
 * as the annotate plugin's `pickShape`.
 */
function pickRegion(
  regions: ReadonlyArray<RedactRegion>,
  point: { x: number; y: number },
): RedactRegion | undefined {
  for (let i = regions.length - 1; i >= 0; i--) {
    const region = regions[i];
    if (!region) continue;
    if (
      point.x >= region.x &&
      point.x <= region.x + region.width &&
      point.y >= region.y &&
      point.y <= region.y + region.height
    ) {
      return region;
    }
  }
  return undefined;
}

function isEditableTarget(target: Element | null): boolean {
  if (!target) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return (target as HTMLElement).isContentEditable === true;
}
