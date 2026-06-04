import {
  DEFAULT_FINETUNE_STATE,
  FILTER_PRESETS,
  type FilterPreset,
  type FilterPresetId,
  type FinetuneState,
  type SourceImage,
  type Store,
  type ViewportController,
  findActivePreset,
} from '@magicpages/kalotyp-core';
import { buildPreviewCanvas, previewViewportFor } from '../../canvas/preview-canvas.js';
import { buildFinetunePreviewPipeline } from '../finetune/preview.js';
import { type ThumbnailCache, buildThumbnailCache, computeThumbnailDims } from './thumbnails.js';

export interface MountFilterOptions {
  readonly stageHost: HTMLElement;
  readonly utilHost: HTMLElement;
  /** Upstream-baked source (same input as the finetune tab — filter shares finetune's slot). */
  readonly source: SourceImage;
  /** Shared store with finetune; clicking a thumbnail writes here. */
  readonly store: Store<FinetuneState>;
  readonly viewport?: ViewportController;
  readonly onCommit?: () => void;
}

export interface MountFilterHandle {
  destroy(): void;
}

export function mountFilterUtility(options: MountFilterOptions): MountFilterHandle {
  const { stageHost, utilHost, source, store, viewport: controller } = options;
  const commit = options.onCommit ?? noop;

  // Mirror of the finetune-tab preview so switching tabs doesn't change what's on screen.
  const preview = buildPreviewCanvas();
  stageHost.appendChild(preview.container);
  const pipeline = buildFinetunePreviewPipeline({
    canvas: preview.canvas,
    sourceBitmap: source.bitmap,
  });

  // Upstream-baked source is fixed for this mount, so the seven thumbnails generate once.
  const dims = computeThumbnailDims({ width: source.width, height: source.height });
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const thumbnailCache = buildThumbnailCache({
    source: source.bitmap,
    dims,
    dpr,
  });

  const strip = buildFilterStrip({
    presets: FILTER_PRESETS,
    thumbnailCache,
    dims,
    onPresetClick: (preset) => {
      const current = store.get();
      const isActiveNow = findActivePreset(current)?.id === preset.id;
      if (isActiveNow && preset.id !== 'none') {
        // Click-to-deselect → all-zeros. Without it, clearing a filter requires dragging sliders back.
        store.update(() => DEFAULT_FINETUNE_STATE);
        commit();
        return;
      }
      store.update(() => preset.state);
      commit();
    },
  });
  utilHost.appendChild(strip.container);

  let upstreamSize = { width: 0, height: 0 };

  function repaint(): void {
    const v = previewViewportFor(
      preview.container,
      { width: source.width, height: source.height },
      controller,
    );
    if (!v) return;
    const display = v.viewport.displayRect;
    const pxW = Math.max(1, Math.round(display.width * dpr));
    const pxH = Math.max(1, Math.round(display.height * dpr));

    preview.canvas.style.width = `${display.width}px`;
    preview.canvas.style.height = `${display.height}px`;
    preview.canvas.style.position = 'absolute';
    preview.canvas.style.left = `${display.x}px`;
    preview.canvas.style.top = `${display.y}px`;

    // Skip the heavy pixel-grid rebuild during a pinch; CSS interp covers it, post-gesture repaint sharpens.
    const pinching = controller?.getPinching() ?? false;
    if (!pinching && (upstreamSize.width !== pxW || upstreamSize.height !== pxH)) {
      upstreamSize = { width: pxW, height: pxH };
      pipeline.rebuild(pxW, pxH);
    }

    pipeline.paint(store.get());
  }

  function syncStripActive(state: FinetuneState): void {
    const activeId = findActivePreset(state)?.id;
    strip.setActive(activeId);
  }

  syncStripActive(store.get());
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
    syncStripActive(next);
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
      thumbnailCache.dispose();
      preview.container.remove();
      strip.container.remove();
    },
  };
}

interface FilterStripOptions {
  readonly presets: readonly FilterPreset[];
  readonly thumbnailCache: ThumbnailCache;
  readonly dims: { width: number; height: number };
  onPresetClick(preset: FilterPreset): void;
}

interface FilterStrip {
  readonly container: HTMLDivElement;
  setActive(id: FilterPresetId | undefined): void;
}

function buildFilterStrip(options: FilterStripOptions): FilterStrip {
  const container = document.createElement('div');
  container.className = 'kalotyp-filter-panel';
  // Radiogroup, not tablist: presets are mutually-exclusive state, not panel switchers.
  container.setAttribute('role', 'radiogroup');
  container.setAttribute('aria-label', 'Filter presets');

  const list = document.createElement('div');
  list.className = 'kalotyp-filter-strip';
  container.appendChild(list);

  const buttons = new Map<FilterPresetId, HTMLButtonElement>();

  for (const preset of options.presets) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'kalotyp-filter-thumb';
    button.dataset.presetId = preset.id;
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-checked', 'false');
    button.setAttribute('aria-label', `${preset.label} filter`);
    button.title = preset.label;

    const thumbWrap = document.createElement('span');
    thumbWrap.className = 'kalotyp-filter-thumb-image';
    thumbWrap.style.width = `${options.dims.width}px`;
    thumbWrap.style.height = `${options.dims.height}px`;
    const canvas = options.thumbnailCache.get(preset);
    canvas.classList.add('kalotyp-filter-thumb-canvas');
    thumbWrap.appendChild(canvas);

    // Active-state checkmark (avoids color-only signalling). aria-hidden: aria-checked is the state carrier.
    const activeBadge = document.createElement('span');
    activeBadge.className = 'kalotyp-filter-thumb-check';
    activeBadge.setAttribute('aria-hidden', 'true');
    activeBadge.innerHTML = '✓';
    thumbWrap.appendChild(activeBadge);

    const labelEl = document.createElement('span');
    labelEl.className = 'kalotyp-filter-thumb-label';
    labelEl.textContent = preset.label;

    button.appendChild(thumbWrap);
    button.appendChild(labelEl);
    button.addEventListener('click', () => options.onPresetClick(preset));

    list.appendChild(button);
    buttons.set(preset.id, button);
  }

  return {
    container,
    setActive(id) {
      for (const [presetId, button] of buttons) {
        const isActive = presetId === id;
        button.setAttribute('aria-checked', isActive ? 'true' : 'false');
        button.classList.toggle('kalotyp-filter-thumb--active', isActive);
      }
    },
  };
}

function noop(): void {}
