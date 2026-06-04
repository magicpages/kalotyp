import {
  type CropPreset,
  type CropPresetFilter,
  type CropState,
  type Rect,
  type SourceImage,
  type Store,
  type Viewport,
  type ViewportController,
  applyPresetByIndex,
  clampRectInside,
  computeViewport,
  filterPresets,
  initialCropState,
} from '@magicpages/kalotyp-core';
import { positionHandles } from '../../canvas/position-handles.js';
import { renderImageCanvas } from '../../canvas/render-image.js';
import { renderOverlayCanvas } from '../../canvas/render-overlay.js';
import { buildPresetRow, setActivePresetButton } from '../../dom/build-preset-row.js';
import { buildStageElements } from '../../dom/build-stage.js';
import { bindCropInteractions } from './interaction.js';

export interface MountCropOptions {
  readonly stageHost: HTMLElement;
  readonly utilHost: HTMLElement;
  readonly source: SourceImage;
  readonly presets: readonly CropPreset[];
  readonly presetFilter: CropPresetFilter | undefined;
  readonly store: Store<CropState>;
  /** Editor-level zoom + pan. Optional — falls back to fit-only viewports when absent. */
  readonly viewport?: ViewportController;
  readonly onCommit?: () => void;
}

export interface MountCropHandle {
  destroy(): void;
}

const STAGE_PADDING_PX = 32;

/** Mount the crop UI. Expects the store pre-initialised via `initialCropState`. */
export function mountCropUtility(options: MountCropOptions): MountCropHandle {
  const {
    stageHost,
    utilHost,
    source,
    presets,
    presetFilter,
    store,
    viewport: controller,
  } = options;
  const commit = options.onCommit ?? noop;

  const stage = buildStageElements();
  stageHost.appendChild(stage.container);

  const panelContainer = document.createElement('div');
  panelContainer.className = 'kalotyp-crop-panel';

  const visiblePresets = filterPresets(presets, presetFilter);
  const initialActive = mapToVisibleIndex(store.get(), presets, visiblePresets);
  const presetRow = buildPresetRow(visiblePresets, initialActive, (visibleIndex, preset) => {
    const fullIndex = presets.indexOf(preset);
    if (fullIndex === -1) return;
    const next = applyPresetByIndex(store.get(), fullIndex);
    store.set({
      rect: next.rect,
      aspectRatio: next.aspectRatio,
      activePresetIndex: fullIndex,
    });
    setActivePresetButton(presetRow.buttons, visibleIndex);
    commit();
  });
  panelContainer.appendChild(presetRow.container);

  const dimensions = buildCropDimensionsRow({
    initial: store.get().rect,
    bounds: { width: source.width, height: source.height },
    onCommit(next) {
      const current = store.get();
      const bounds: Rect = {
        x: 0,
        y: 0,
        width: current.imageSize.width,
        height: current.imageSize.height,
      };
      const clamped = clampRectInside(next, bounds);
      store.set({ rect: clamped });
      commit();
    },
  });
  panelContainer.appendChild(dimensions.container);

  utilHost.appendChild(panelContainer);

  let viewport: Viewport = computeViewport(
    { width: 1, height: 1, padding: STAGE_PADDING_PX },
    { width: source.width, height: source.height },
  );

  function recomputeViewport(): void {
    const rect = stage.container.getBoundingClientRect();
    const stageDims = { width: rect.width, height: rect.height, padding: STAGE_PADDING_PX };
    const imageSize = { width: source.width, height: source.height };
    viewport = controller
      ? controller.computeViewport(stageDims, imageSize)
      : computeViewport(stageDims, imageSize);
  }

  function paintAll(): void {
    const rect = stage.container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    renderImageCanvas(stage.imageCanvas, source.bitmap, rect.width, rect.height, viewport);
    paintOverlay();
  }

  function paintOverlay(): void {
    const rect = stage.container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    renderOverlayCanvas(stage.overlayCanvas, store.get().rect, rect.width, rect.height, viewport);
    positionHandles({
      cropRectImage: store.get().rect,
      viewport,
      cornerAnchors: stage.cornerAnchors,
      edgeHandles: {
        t: stage.handles.t,
        r: stage.handles.r,
        b: stage.handles.b,
        l: stage.handles.l,
      },
      bodyHitArea: stage.bodyHitArea,
    });
  }

  recomputeViewport();
  paintAll();

  const resizeObserver = new ResizeObserver(() => {
    recomputeViewport();
    paintAll();
  });
  resizeObserver.observe(stage.container);

  // Viewport changes flow outside the store — schedule our own rAF to coalesce wheel/pinch bursts.
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

  let overlayRafScheduled = false;
  const unsubscribe = store.subscribe((next, previous) => {
    syncPresetButtons(next, previous, presets, visiblePresets, presetRow.buttons);
    if (rectsEqual(next.rect, previous.rect)) return;
    dimensions.sync(next.rect);
    if (overlayRafScheduled) return;
    overlayRafScheduled = true;
    requestAnimationFrame(() => {
      overlayRafScheduled = false;
      paintOverlay();
    });
  });

  const interactions = bindCropInteractions(
    {
      stageElement: stage.container,
      handles: stage.handles,
      bodyHitArea: stage.bodyHitArea,
    },
    store,
    { getViewport: () => viewport, onCommit: commit },
  );

  return {
    destroy() {
      interactions.destroy();
      unsubscribe();
      unsubscribeViewport?.();
      resizeObserver.disconnect();
      stage.container.remove();
      panelContainer.remove();
    },
  };
}

interface CropDimensionsRow {
  readonly container: HTMLDivElement;
  sync(rect: Rect): void;
}

interface BuildCropDimensionsRowOptions {
  readonly initial: Rect;
  readonly bounds: { readonly width: number; readonly height: number };
  onCommit(rect: Rect): void;
}

/** Four numeric inputs (x/y/w/h) committing on blur or Enter. Caller clamps to image bounds. */
function buildCropDimensionsRow(options: BuildCropDimensionsRowOptions): CropDimensionsRow {
  const container = document.createElement('div');
  container.className = 'kalotyp-crop-dims';
  container.setAttribute('role', 'group');
  container.setAttribute('aria-label', 'Crop region dimensions');

  const xInput = makeNumericInput('Left', options.initial.x, 0, options.bounds.width);
  const yInput = makeNumericInput('Top', options.initial.y, 0, options.bounds.height);
  const wInput = makeNumericInput('Width', options.initial.width, 1, options.bounds.width);
  const hInput = makeNumericInput('Height', options.initial.height, 1, options.bounds.height);

  function readRect(): Rect {
    return {
      x: Math.round(xInput.input.valueAsNumber),
      y: Math.round(yInput.input.valueAsNumber),
      width: Math.round(wInput.input.valueAsNumber),
      height: Math.round(hInput.input.valueAsNumber),
    };
  }

  for (const field of [xInput, yInput, wInput, hInput]) {
    field.input.addEventListener('change', () => {
      const next = readRect();
      if (!Number.isFinite(next.x + next.y + next.width + next.height)) return;
      options.onCommit(next);
    });
  }

  container.appendChild(xInput.wrapper);
  container.appendChild(yInput.wrapper);
  container.appendChild(wInput.wrapper);
  container.appendChild(hInput.wrapper);

  function sync(rect: Rect): void {
    if (xInput.input.valueAsNumber !== rect.x) xInput.input.value = String(Math.round(rect.x));
    if (yInput.input.valueAsNumber !== rect.y) yInput.input.value = String(Math.round(rect.y));
    if (wInput.input.valueAsNumber !== rect.width)
      wInput.input.value = String(Math.round(rect.width));
    if (hInput.input.valueAsNumber !== rect.height)
      hInput.input.value = String(Math.round(rect.height));
  }

  return { container, sync };
}

function makeNumericInput(
  label: string,
  value: number,
  min: number,
  max: number,
): { wrapper: HTMLLabelElement; input: HTMLInputElement } {
  const wrapper = document.createElement('label');
  wrapper.className = 'kalotyp-crop-dims-field';

  const labelSpan = document.createElement('span');
  labelSpan.className = 'kalotyp-crop-dims-label';
  labelSpan.textContent = label;

  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'kalotyp-crop-dims-input';
  input.min = String(min);
  input.max = String(max);
  input.step = '1';
  input.value = String(Math.round(value));
  input.inputMode = 'numeric';
  input.setAttribute('aria-label', `${label} (pixels)`);

  wrapper.appendChild(labelSpan);
  wrapper.appendChild(input);
  return { wrapper, input };
}

export { initialCropState };

function noop(): void {}

function rectsEqual(a: Rect, b: Rect): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

function mapToVisibleIndex(
  state: CropState,
  fullPresets: readonly CropPreset[],
  visiblePresets: readonly CropPreset[],
): number {
  if (state.activePresetIndex === -1) return -1;
  const active = fullPresets[state.activePresetIndex];
  if (!active) return -1;
  return visiblePresets.indexOf(active);
}

function syncPresetButtons(
  next: CropState,
  previous: CropState,
  fullPresets: readonly CropPreset[],
  visiblePresets: readonly CropPreset[],
  buttons: readonly HTMLButtonElement[],
): void {
  if (next.activePresetIndex === previous.activePresetIndex) return;
  const visibleIndex = mapToVisibleIndex(next, fullPresets, visiblePresets);
  setActivePresetButton(buttons, visibleIndex);
}
