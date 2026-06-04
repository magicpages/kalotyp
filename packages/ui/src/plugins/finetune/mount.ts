import {
  FINETUNE_ADJUSTMENTS,
  FINETUNE_MAX,
  FINETUNE_MIN,
  FINETUNE_STEP,
  type FinetuneKey,
  type FinetuneState,
  resetAllFinetune,
  resetFinetune,
  type SourceImage,
  type Store,
  setFinetune,
  type ViewportController,
} from '@magicpages/kalotyp-core';
import { buildPreviewCanvas, previewViewportFor } from '../../canvas/preview-canvas.js';
import { buildFinetunePreviewPipeline } from './preview.js';

export interface MountFinetuneOptions {
  readonly stageHost: HTMLElement;
  readonly utilHost: HTMLElement;
  readonly source: SourceImage;
  readonly store: Store<FinetuneState>;
  /** Editor-level zoom + pan controller. Optional in jsdom tests. */
  readonly viewport?: ViewportController;
  /** Fires on slider `change` / number `change` / reset (one undo entry per drag, not per `input`). */
  readonly onCommit?: () => void;
}

export interface MountFinetuneHandle {
  destroy(): void;
}

export function mountFinetuneUtility(options: MountFinetuneOptions): MountFinetuneHandle {
  const { stageHost, utilHost, source, store, viewport: controller } = options;
  const commit = options.onCommit ?? noop;

  const preview = buildPreviewCanvas();
  stageHost.appendChild(preview.container);

  const pipeline = buildFinetunePreviewPipeline({
    canvas: preview.canvas,
    sourceBitmap: source.bitmap,
  });

  const panel = buildFinetunePanel({
    onSliderInput: (key, value) => store.set(setFinetune(store.get(), key, value)),
    onSliderCommit: () => commit(),
    onNumberCommit: (key, value) => {
      store.set(setFinetune(store.get(), key, value));
      commit();
    },
    onRowReset: (key) => {
      store.set(resetFinetune(store.get(), key));
      commit();
    },
    onResetAll: () => {
      store.update(() => resetAllFinetune());
      commit();
    },
  });
  utilHost.appendChild(panel.container);

  let upstreamSize = { width: 0, height: 0 };

  function repaint(): void {
    const v = previewViewportFor(
      preview.container,
      { width: source.width, height: source.height },
      controller,
    );
    if (!v) return;
    const display = v.viewport.displayRect;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const pxW = Math.max(1, Math.round(display.width * dpr));
    const pxH = Math.max(1, Math.round(display.height * dpr));

    // Canvas is the math's surface (pipeline does getImageData/putImageData) — no transformed ctx, so paintPreview's DPR dance doesn't apply.
    preview.canvas.style.width = `${display.width}px`;
    preview.canvas.style.height = `${display.height}px`;
    preview.canvas.style.position = 'absolute';
    preview.canvas.style.left = `${display.x}px`;
    preview.canvas.style.top = `${display.y}px`;

    // Skip the CPU rebuild during pinch — CSS interp on the existing buffer is good enough; post-gesture repaint sharpens.
    const pinching = controller?.getPinching() ?? false;
    if (!pinching && (upstreamSize.width !== pxW || upstreamSize.height !== pxH)) {
      upstreamSize = { width: pxW, height: pxH };
      pipeline.rebuild(pxW, pxH);
    }

    pipeline.paint(store.get());
  }

  function syncPanel(state: FinetuneState): void {
    for (const adj of FINETUNE_ADJUSTMENTS) {
      const row = panel.rows.get(adj.key);
      if (!row) continue;
      const value = state[adj.key];
      if (row.slider.valueAsNumber !== value) row.slider.valueAsNumber = value;
      if (Number.parseFloat(row.input.value || '0') !== value) row.input.value = String(value);
    }
  }

  syncPanel(store.get());
  repaint();

  const resizeObserver = new ResizeObserver(() => repaint());
  resizeObserver.observe(preview.container);

  let viewportRafScheduled = false;
  const unsubscribeViewport = controller?.subscribe(() => {
    if (viewportRafScheduled) return;
    viewportRafScheduled = true;
    requestAnimationFrame(() => {
      viewportRafScheduled = false;
      repaint();
    });
  });

  let rafScheduled = false;
  const unsubscribe = store.subscribe((next) => {
    syncPanel(next);
    if (rafScheduled) return;
    rafScheduled = true;
    requestAnimationFrame(() => {
      rafScheduled = false;
      pipeline.paint(store.get());
    });
  });

  return {
    destroy() {
      unsubscribe();
      unsubscribeViewport?.();
      resizeObserver.disconnect();
      pipeline.dispose();
      preview.container.remove();
      panel.container.remove();
    },
  };
}

interface FinetunePanelOptions {
  onSliderInput(key: FinetuneKey, value: number): void;
  onSliderCommit(): void;
  onNumberCommit(key: FinetuneKey, value: number): void;
  onRowReset(key: FinetuneKey): void;
  onResetAll(): void;
}

interface FinetuneRowEls {
  readonly row: HTMLDivElement;
  readonly slider: HTMLInputElement;
  readonly input: HTMLInputElement;
  readonly resetButton: HTMLButtonElement;
}

interface FinetunePanel {
  container: HTMLDivElement;
  rows: ReadonlyMap<FinetuneKey, FinetuneRowEls>;
  resetAllButton: HTMLButtonElement;
}

function buildFinetunePanel(options: FinetunePanelOptions): FinetunePanel {
  const container = document.createElement('div');
  container.className = 'kalotyp-finetune-panel';
  container.setAttribute('role', 'group');
  container.setAttribute('aria-label', 'Finetune adjustments');

  const rows = new Map<FinetuneKey, FinetuneRowEls>();
  for (const adj of FINETUNE_ADJUSTMENTS) {
    const row = buildAdjustmentRow(adj.key, adj.label, options);
    rows.set(adj.key, row);
    container.appendChild(row.row);
  }

  const resetAllButton = document.createElement('button');
  resetAllButton.type = 'button';
  resetAllButton.className = 'kalotyp-finetune-reset-all';
  resetAllButton.textContent = 'Reset all';
  resetAllButton.title = 'Reset every adjustment to 0';
  resetAllButton.addEventListener('click', options.onResetAll);
  container.appendChild(resetAllButton);

  return { container, rows, resetAllButton };
}

function buildAdjustmentRow(
  key: FinetuneKey,
  label: string,
  options: FinetunePanelOptions,
): FinetuneRowEls {
  const row = document.createElement('div');
  row.className = 'kalotyp-finetune-row';
  row.dataset.adjustment = key;

  const labelEl = document.createElement('label');
  labelEl.className = 'kalotyp-finetune-label';
  labelEl.textContent = label;

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'kalotyp-finetune-slider';
  slider.min = String(FINETUNE_MIN);
  slider.max = String(FINETUNE_MAX);
  slider.step = String(FINETUNE_STEP);
  slider.value = '0';
  slider.setAttribute('aria-label', `${label} adjustment`);
  slider.addEventListener('input', () => options.onSliderInput(key, slider.valueAsNumber));
  slider.addEventListener('change', () => options.onSliderCommit());

  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'kalotyp-finetune-input';
  input.min = String(FINETUNE_MIN);
  input.max = String(FINETUNE_MAX);
  input.step = String(FINETUNE_STEP);
  input.value = '0';
  input.inputMode = 'numeric';
  input.setAttribute('aria-label', `${label} value`);
  input.addEventListener('change', () => {
    const v = input.valueAsNumber;
    if (Number.isFinite(v)) options.onNumberCommit(key, v);
  });

  const resetButton = document.createElement('button');
  resetButton.type = 'button';
  resetButton.className = 'kalotyp-finetune-row-reset';
  resetButton.setAttribute('aria-label', `Reset ${label}`);
  resetButton.title = `Reset ${label}`;
  resetButton.textContent = '↺';
  resetButton.addEventListener('click', () => options.onRowReset(key));

  row.appendChild(labelEl);
  row.appendChild(slider);
  row.appendChild(input);
  row.appendChild(resetButton);

  return { row, slider, input, resetButton };
}

function noop(): void {}
