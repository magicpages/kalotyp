/**
 * Mount the frame plugin: a preset thumbnail strip (six entries
 * matching Ghost's `frameOptions` order) plus a colour picker for the
 * presets that accept colour customisation. The stage shows the
 * upstream-baked source with the active frame composited on top.
 *
 * frame is the chain's tail link, so the live preview
 * is conceptually "what the user gets on Save." We render the source
 * + frame composite into a single preview canvas; clicking a
 * thumbnail updates the store, the preview re-renders, and the
 * editor's history captures the commit.
 */

import {
  FRAME_PRESETS,
  type FramePreset,
  type FramePresetId,
  type FrameState,
  type SourceImage,
  type Store,
  type Viewport,
  type ViewportController,
  computeViewport,
  frameOutputSize,
  paintInsideFrame,
  setFrameColor,
  setFramePreset,
} from '@magicpages/kalotyp-core';

const STAGE_PADDING_PX = 32;

export interface MountFrameOptions {
  readonly stageHost: HTMLElement;
  readonly utilHost: HTMLElement;
  readonly source: SourceImage;
  readonly store: Store<FrameState>;
  readonly viewport?: ViewportController | undefined;
  /**
   * Optional locale callbacks Ghost passes via `frameOptions[i][1]`.
   * The factory wires this from the Ghost adapter; the playground
   * passes nothing and the strip falls back to the preset's default
   * label.
   */
  readonly labels?: Partial<Record<FramePresetId, string>> | undefined;
  readonly onCommit?: (() => void) | undefined;
}

export interface MountFrameHandle {
  destroy(): void;
}

export function mountFrameUtility(options: MountFrameOptions): MountFrameHandle {
  const { stageHost, utilHost, source, store, viewport: controller } = options;
  const commit = options.onCommit ?? (() => {});

  // Stage: a preview canvas the same shape the finetune/filter
  // plugins use. We render the upstream image + frame composite at
  // every paint.
  const previewContainer = document.createElement('div');
  previewContainer.className = 'kalotyp-stage-container kalotyp-frame-preview-container';
  const previewCanvas = document.createElement('canvas');
  previewCanvas.className = 'kalotyp-stage-image kalotyp-frame-preview-canvas';
  previewCanvas.setAttribute('aria-hidden', 'true');
  previewContainer.appendChild(previewCanvas);
  stageHost.appendChild(previewContainer);

  // Build the strip + colour picker.
  const initialState = store.get();
  const stripContainer = document.createElement('div');
  stripContainer.className = 'kalotyp-frame-panel';

  const strip = buildFrameStrip({
    presets: FRAME_PRESETS,
    initialActiveId: initialState.presetId,
    labels: options.labels,
    source,
    initialState,
    onPresetClick: (preset) => {
      store.update((current) => setFramePreset(current, preset.id));
      commit();
    },
  });
  stripContainer.appendChild(strip.container);

  const colorRow = buildColourRow({
    initialColor: initialState.color,
    initialPresetId: initialState.presetId,
    onColorChange: (color) => {
      store.update((current) => setFrameColor(current, color));
      commit();
    },
  });
  stripContainer.appendChild(colorRow.container);

  utilHost.appendChild(stripContainer);

  let viewport: Viewport = computeViewport(
    { width: 1, height: 1, padding: STAGE_PADDING_PX },
    { width: source.width, height: source.height },
  );

  function recomputeViewport(): void {
    const rect = previewContainer.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const stageDims = { width: rect.width, height: rect.height, padding: STAGE_PADDING_PX };
    // The frame plugin's preview accounts for the *output* dimensions
    // (which differ from the source for Polaroid). Compute the
    // viewport against the frame's output dims so the framed
    // composite letterboxes correctly inside the stage.
    const state = store.get();
    const out = frameOutputSize(state.presetId, source.width, source.height);
    viewport = controller
      ? controller.computeViewport(stageDims, out)
      : computeViewport(stageDims, out);
  }

  function repaint(): void {
    const rect = previewContainer.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const targetW = Math.max(1, Math.round(rect.width * dpr));
    const targetH = Math.max(1, Math.round(rect.height * dpr));
    if (previewCanvas.width !== targetW) previewCanvas.width = targetW;
    if (previewCanvas.height !== targetH) previewCanvas.height = targetH;
    previewCanvas.style.width = `${rect.width}px`;
    previewCanvas.style.height = `${rect.height}px`;
    const ctx = previewCanvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const state = store.get();
    const out = frameOutputSize(state.presetId, source.width, source.height);
    const dx = viewport.displayRect.x;
    const dy = viewport.displayRect.y;
    const dw = viewport.displayRect.width;
    const dh = viewport.displayRect.height;

    // For polaroid we need to draw the polaroid border first then
    // the source image inset by its inner-edge thickness. For the
    // other presets we draw the source full-size then paint the
    // frame on top.
    if (state.presetId === 'polaroid') {
      // Border colour fills the entire output rect.
      ctx.fillStyle = state.color;
      ctx.fillRect(dx, dy, dw, dh);
      // Compute the inset proportions (matching bake.ts). The inner
      // image lives at (top/left, top/top) of the output, sized so
      // its aspect ratio matches the source.
      const innerW = source.width * (dw / out.width);
      const innerH = source.height * (dh / out.height);
      const shorter = Math.min(source.width, source.height);
      const inset = Math.round(shorter * 0.05);
      const innerOffsetX = dx + (inset * dw) / out.width;
      const innerOffsetY = dy + (inset * dh) / out.height;
      ctx.drawImage(source.bitmap, innerOffsetX, innerOffsetY, innerW, innerH);
    } else {
      // Draw the source filling the displayRect.
      ctx.drawImage(source.bitmap, dx, dy, dw, dh);
      if (state.presetId !== 'none') {
        // Paint the frame in display-pixel space at the displayRect's
        // dimensions. Translate so frame coordinates start at (dx, dy).
        ctx.save();
        ctx.translate(dx, dy);
        paintInsideFrame(ctx, state.presetId, state.color, dw, dh);
        ctx.restore();
      }
    }
  }

  recomputeViewport();
  repaint();

  const resizeObserver = new ResizeObserver(() => {
    recomputeViewport();
    repaint();
  });
  resizeObserver.observe(previewContainer);

  let viewportRafScheduled = false;
  const unsubscribeViewport = controller?.subscribe(() => {
    if (viewportRafScheduled) return;
    viewportRafScheduled = true;
    requestAnimationFrame(() => {
      viewportRafScheduled = false;
      recomputeViewport();
      repaint();
    });
  });

  let rafScheduled = false;
  const unsubscribe = store.subscribe((next) => {
    strip.setActive(next.presetId);
    colorRow.setColor(next.color);
    colorRow.setEnabled(next.presetId !== 'none');
    if (rafScheduled) return;
    rafScheduled = true;
    requestAnimationFrame(() => {
      rafScheduled = false;
      recomputeViewport();
      repaint();
    });
  });

  return {
    destroy() {
      unsubscribe();
      unsubscribeViewport?.();
      resizeObserver.disconnect();
      previewContainer.remove();
      stripContainer.remove();
    },
  };
}

interface FrameStripOptions {
  readonly presets: readonly FramePreset[];
  readonly initialActiveId: FramePresetId;
  readonly labels?: Partial<Record<FramePresetId, string>> | undefined;
  readonly source: SourceImage;
  readonly initialState: FrameState;
  onPresetClick(preset: FramePreset): void;
}

interface FrameStrip {
  readonly container: HTMLDivElement;
  setActive(id: FramePresetId): void;
}

function buildFrameStrip(options: FrameStripOptions): FrameStrip {
  const container = document.createElement('div');
  container.className = 'kalotyp-frame-strip-wrap';
  container.setAttribute('role', 'radiogroup');
  container.setAttribute('aria-label', 'Frame presets');

  const list = document.createElement('div');
  list.className = 'kalotyp-frame-strip';
  container.appendChild(list);

  const buttons = new Map<FramePresetId, HTMLButtonElement>();
  for (const preset of options.presets) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'kalotyp-frame-thumb';
    button.dataset.presetId = preset.id;
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-checked', 'false');
    const label = options.labels?.[preset.id] ?? preset.label;
    button.setAttribute('aria-label', `${label} frame`);
    button.title = label;

    const thumbWrap = document.createElement('span');
    thumbWrap.className = 'kalotyp-frame-thumb-image';
    const canvas = renderFrameThumbnail(preset, options.source, options.initialState.color);
    canvas.classList.add('kalotyp-frame-thumb-canvas');
    thumbWrap.appendChild(canvas);

    const activeBadge = document.createElement('span');
    activeBadge.className = 'kalotyp-frame-thumb-check';
    activeBadge.setAttribute('aria-hidden', 'true');
    activeBadge.innerHTML = '✓';
    thumbWrap.appendChild(activeBadge);

    const labelEl = document.createElement('span');
    labelEl.className = 'kalotyp-frame-thumb-label';
    labelEl.textContent = label;

    button.appendChild(thumbWrap);
    button.appendChild(labelEl);
    button.addEventListener('click', () => options.onPresetClick(preset));

    list.appendChild(button);
    buttons.set(preset.id, button);
  }

  function setActive(id: FramePresetId): void {
    for (const [presetId, button] of buttons) {
      const isActive = presetId === id;
      button.setAttribute('aria-checked', isActive ? 'true' : 'false');
      button.classList.toggle('kalotyp-frame-thumb--active', isActive);
    }
  }

  setActive(options.initialActiveId);

  return { container, setActive };
}

interface ColourRowOptions {
  readonly initialColor: string;
  readonly initialPresetId: FramePresetId;
  onColorChange(color: string): void;
}

interface ColourRow {
  readonly container: HTMLDivElement;
  setColor(color: string): void;
  setEnabled(enabled: boolean): void;
}

function buildColourRow(options: ColourRowOptions): ColourRow {
  const container = document.createElement('div');
  container.className = 'kalotyp-frame-color-row';

  const label = document.createElement('span');
  label.className = 'kalotyp-frame-color-label';
  label.textContent = 'Colour';

  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.className = 'kalotyp-frame-color';
  colorInput.value = normaliseColorForInput(options.initialColor);
  colorInput.setAttribute('aria-label', 'Frame colour (visual picker)');
  colorInput.addEventListener('change', () => options.onColorChange(colorInput.value));

  const hexInput = document.createElement('input');
  hexInput.type = 'text';
  hexInput.className = 'kalotyp-frame-hex';
  hexInput.value = normaliseColorForInput(options.initialColor);
  hexInput.maxLength = 7;
  hexInput.spellcheck = false;
  hexInput.autocomplete = 'off';
  hexInput.setAttribute('aria-label', 'Frame colour hex code');
  hexInput.setAttribute('placeholder', '#000000');
  hexInput.addEventListener('change', () => {
    const value = hexInput.value.trim();
    const normalised = normaliseHexInput(value);
    if (normalised) {
      hexInput.value = normalised;
      options.onColorChange(normalised);
    } else {
      hexInput.value = colorInput.value;
    }
  });

  // Helper text that explains the disabled state under the None
  // preset (Phase 6.6 polish). Hidden when colour customisation is
  // available. `aria-live` so screen-reader users hear the
  // explanation when they switch presets.
  const hint = document.createElement('span');
  hint.className = 'kalotyp-frame-color-hint';
  hint.textContent = 'Pick a frame preset to choose a colour.';
  hint.setAttribute('aria-live', 'polite');

  container.appendChild(label);
  container.appendChild(colorInput);
  container.appendChild(hexInput);
  container.appendChild(hint);

  // None doesn't accept colour customisation; disable the inputs to
  // avoid the user wasting time on a control that has no effect.
  function setEnabled(enabled: boolean): void {
    colorInput.disabled = !enabled;
    hexInput.disabled = !enabled;
    hint.hidden = enabled;
  }
  function setColor(color: string): void {
    const target = normaliseColorForInput(color);
    if (colorInput.value !== target) colorInput.value = target;
    if (hexInput.value.toLowerCase() !== target.toLowerCase()) hexInput.value = target;
  }
  setEnabled(options.initialPresetId !== 'none');

  return { container, setColor, setEnabled };
}

/**
 * Render a small preview canvas of the source under a given frame
 * preset. The thumbnails fit inside an 80×60 box (matching the filter
 * strip's max), and the source is downscaled to fit. The bake we
 * use here is the same path the chain uses on Save — `bakeFrame` is
 * synchronous-shaped (Promise-returning but resolves immediately),
 * so we render synchronously by reading the resulting canvas
 * bitmap into the thumbnail.
 *
 * For Polaroid the bake output is larger than the input, so the
 * thumbnail's aspect ratio differs from the other presets. We
 * re-letterbox the polaroid output into the same 80×60 box so the
 * strip's row height stays consistent.
 */
function renderFrameThumbnail(
  preset: FramePreset,
  source: SourceImage,
  color: string,
): HTMLCanvasElement {
  const max = { width: 80, height: 60 };
  const out = frameOutputSize(preset.id, source.width, source.height);
  const ratio = Math.min(max.width / out.width, max.height / out.height);
  const w = Math.max(1, Math.floor(out.width * ratio));
  const h = Math.max(1, Math.floor(out.height * ratio));
  const dpr = Math.max(1, window.devicePixelRatio || 1);

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * dpr));
  canvas.height = Math.max(1, Math.round(h * dpr));
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Render the source + frame at the thumbnail's display size. We
  // can't reuse `bakeFrame` directly because the bake produces an
  // output at the frame's full output dimensions; the thumbnail is
  // a downscale of that. So we approximate by drawing inline.
  if (preset.id === 'polaroid') {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    const shorter = Math.min(source.width, source.height);
    const innerOffsetX = Math.round(((shorter * 0.05) / out.width) * w);
    const innerOffsetY = Math.round(((shorter * 0.05) / out.height) * h);
    const innerW = Math.round((source.width / out.width) * w);
    const innerH = Math.round((source.height / out.height) * h);
    ctx.drawImage(source.bitmap, innerOffsetX, innerOffsetY, innerW, innerH);
  } else {
    ctx.drawImage(source.bitmap, 0, 0, w, h);
    if (preset.id !== 'none') {
      paintInsideFrame(ctx, preset.id, color, w, h);
    }
  }

  return canvas;
}

function normaliseColorForInput(color: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  if (/^#[0-9a-fA-F]{3}$/.test(color)) {
    const r = color[1];
    const g = color[2];
    const b = color[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return '#000000';
}

function normaliseHexInput(value: string): string | null {
  const cleaned = value.startsWith('#') ? value.slice(1) : value;
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) return `#${cleaned.toLowerCase()}`;
  if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    const r = cleaned[0];
    const g = cleaned[1];
    const b = cleaned[2];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return null;
}
