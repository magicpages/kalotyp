import {
  RESIZE_MAX_DIMENSION,
  RESIZE_MIN_DIMENSION,
  type ResizeState,
  type SourceImage,
  type Store,
  type ViewportController,
  resolveOutputSize,
  setHeightPx,
  setLockAspect,
  setPercent,
  setWidthPx,
} from '@magicpages/kalotyp-core';
import {
  buildPreviewCanvas,
  paintPreview,
  previewViewportFor,
} from '../../canvas/preview-canvas.js';
import { icon } from '../../icons.js';

export interface MountResizeOptions {
  readonly stageHost: HTMLElement;
  readonly utilHost: HTMLElement;
  readonly source: SourceImage;
  readonly store: Store<ResizeState>;
  /** Editor-level zoom + pan controller. Optional in jsdom tests. */
  readonly viewport?: ViewportController;
  /**
   * Called after each width/height/percent/lock change so the editor
   * can capture an undo snapshot. Inputs already commit on
   * `change` (blur/Enter), not `input`, so a single typed value is one
   * undo step.
   */
  readonly onCommit?: () => void;
}

export interface MountResizeHandle {
  destroy(): void;
}

export function mountResizeUtility(options: MountResizeOptions): MountResizeHandle {
  const { stageHost, utilHost, source, store, viewport: controller } = options;
  const commit = options.onCommit ?? (() => {});

  const preview = buildPreviewCanvas();
  stageHost.appendChild(preview.container);

  const upstream = { width: source.width, height: source.height };
  const panel = buildResizePanel({
    upstream,
    onWidthChange: (px) => {
      store.set(setWidthPx(store.get(), px, upstream));
      commit();
    },
    onHeightChange: (px) => {
      store.set(setHeightPx(store.get(), px, upstream));
      commit();
    },
    onPercentChange: (pct) => {
      store.set(setPercent(store.get(), pct));
      commit();
    },
    onLockChange: (locked) => {
      store.set(setLockAspect(store.get(), locked));
      commit();
    },
  });
  utilHost.appendChild(panel.container);

  function paint(): void {
    const v = previewViewportFor(preview.container, upstream, controller);
    if (!v) return;
    paintPreview(preview.canvas, v.stageWidth, v.stageHeight, (ctx) => {
      const display = v.viewport.displayRect;
      ctx.drawImage(source.bitmap, display.x, display.y, display.width, display.height);
    });
  }

  function syncPanel(state: ResizeState): void {
    const out = resolveOutputSize(state, upstream);
    if (panel.widthInput.valueAsNumber !== out.width) panel.widthInput.value = String(out.width);
    if (panel.heightInput.valueAsNumber !== out.height)
      panel.heightInput.value = String(out.height);
    const percent = (state.scaleX + state.scaleY) / 2;
    const percentDisplay = Math.round(percent * 1000) / 10;
    if (Number.parseFloat(panel.percentInput.value || '0') !== percentDisplay) {
      panel.percentInput.value = String(percentDisplay);
    }
    panel.lockButton.setAttribute('aria-pressed', state.lockAspect ? 'true' : 'false');
    panel.lockButton.setAttribute(
      'aria-label',
      state.lockAspect
        ? 'Aspect ratio locked — click to unlock'
        : 'Aspect ratio unlocked — click to lock',
    );
    panel.lockButton.title = state.lockAspect ? 'Aspect ratio locked' : 'Aspect ratio unlocked';
    panel.lockButton.innerHTML = chainIconSvg(state.lockAspect);
    panel.summary.textContent = `${out.width} × ${out.height}px (from ${upstream.width} × ${upstream.height}px)`;
  }

  syncPanel(store.get());
  paint();

  const resizeObserver = new ResizeObserver(() => paint());
  resizeObserver.observe(preview.container);

  let viewportRafScheduled = false;
  const unsubscribeViewport = controller?.subscribe(() => {
    if (viewportRafScheduled) return;
    viewportRafScheduled = true;
    requestAnimationFrame(() => {
      viewportRafScheduled = false;
      paint();
    });
  });

  const unsubscribe = store.subscribe((next) => {
    syncPanel(next);
  });

  return {
    destroy() {
      unsubscribe();
      unsubscribeViewport?.();
      resizeObserver.disconnect();
      preview.container.remove();
      panel.container.remove();
    },
  };
}

interface ResizePanelOptions {
  readonly upstream: { width: number; height: number };
  onWidthChange(px: number): void;
  onHeightChange(px: number): void;
  onPercentChange(pct: number): void;
  onLockChange(locked: boolean): void;
}

interface ResizePanel {
  container: HTMLDivElement;
  widthInput: HTMLInputElement;
  heightInput: HTMLInputElement;
  percentInput: HTMLInputElement;
  lockButton: HTMLButtonElement;
  summary: HTMLSpanElement;
}

function buildResizePanel(options: ResizePanelOptions): ResizePanel {
  const container = document.createElement('div');
  container.className = 'kalotyp-resize-panel';
  container.setAttribute('role', 'group');
  container.setAttribute('aria-label', 'Resize');

  const widthInput = makeNumberInput({
    label: 'Width (px)',
    min: RESIZE_MIN_DIMENSION,
    max: RESIZE_MAX_DIMENSION,
    step: 1,
    value: options.upstream.width,
    onChange: options.onWidthChange,
  });
  const heightInput = makeNumberInput({
    label: 'Height (px)',
    min: RESIZE_MIN_DIMENSION,
    max: RESIZE_MAX_DIMENSION,
    step: 1,
    value: options.upstream.height,
    onChange: options.onHeightChange,
  });
  const percentInput = makeNumberInput({
    label: 'Scale (%)',
    min: 1,
    max: 1000,
    step: 0.1,
    value: 100,
    onChange: options.onPercentChange,
  });

  // Small icon-only button between Width and Height — the convention
  // every desktop image-editor uses (GIMP / Photoshop / Photopea /
  // Figma / filerobot's Image Size dialog: a chain-link icon that
  // visually links W to H, closed when ratio is locked and broken
  // when not). The button itself is a 32×32 square with the chain
  // icon centred; aria-pressed carries the state.
  const lockButton = document.createElement('button');
  lockButton.type = 'button';
  lockButton.className = 'kalotyp-resize-lock';
  lockButton.setAttribute('aria-pressed', 'true');
  lockButton.setAttribute('aria-label', 'Lock aspect ratio');
  lockButton.title = 'Lock aspect ratio';
  lockButton.innerHTML = chainIconSvg(true);
  lockButton.addEventListener('click', () => {
    const next = lockButton.getAttribute('aria-pressed') !== 'true';
    options.onLockChange(next);
  });

  const summary = document.createElement('span');
  summary.className = 'kalotyp-resize-summary';
  summary.setAttribute('aria-live', 'polite');
  // Helper text moved to a `title` on the panel — surfacing the
  // 8000px cap via tooltip rather than a permanent caption keeps the
  // panel a single tidy row in line with Crop / Flip / Rotate.
  summary.textContent = `${options.upstream.width} × ${options.upstream.height}px`;

  container.title = `Maximum ${RESIZE_MAX_DIMENSION}px on either axis`;

  // Single flat row — the panel container is flex-row+wrap+centred
  // (transform.css). Width / [lock] / Height puts the chain-link
  // button between the two inputs it relates, matching every
  // desktop editor's Image Size dialog.
  const dimsRow = document.createElement('div');
  dimsRow.className = 'kalotyp-resize-row kalotyp-resize-dims';
  dimsRow.appendChild(widthInput.wrapper);
  dimsRow.appendChild(lockButton);
  dimsRow.appendChild(heightInput.wrapper);

  const scaleRow = document.createElement('div');
  scaleRow.className = 'kalotyp-resize-row';
  scaleRow.appendChild(percentInput.wrapper);
  scaleRow.appendChild(summary);

  container.appendChild(dimsRow);
  container.appendChild(scaleRow);

  return {
    container,
    widthInput: widthInput.input,
    heightInput: heightInput.input,
    percentInput: percentInput.input,
    lockButton,
    summary,
  };
}

interface NumberInputOptions {
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly value: number;
  onChange(value: number): void;
}

function makeNumberInput(options: NumberInputOptions): {
  wrapper: HTMLLabelElement;
  input: HTMLInputElement;
} {
  const wrapper = document.createElement('label');
  wrapper.className = 'kalotyp-resize-field';

  const labelSpan = document.createElement('span');
  labelSpan.className = 'kalotyp-resize-field-label';
  labelSpan.textContent = options.label;

  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'kalotyp-resize-input';
  input.min = String(options.min);
  input.max = String(options.max);
  input.step = String(options.step);
  input.value = String(options.value);
  input.inputMode = 'numeric';
  input.setAttribute('aria-label', options.label);

  // Commit on `change` (blur/Enter) so the user can type intermediate
  // values without firing a state update on every keystroke.
  input.addEventListener('change', () => {
    const value = input.valueAsNumber;
    if (Number.isFinite(value)) options.onChange(value);
  });

  wrapper.appendChild(labelSpan);
  wrapper.appendChild(input);
  return { wrapper, input };
}

/**
 * Inline SVG for the aspect-lock toggle. Sourced from the shared
 * Lucide-backed icon module (`link-2` for locked, `link-2-off` for
 * unlocked). `currentColor` on the strokes lets the icon inherit the
 * button's text colour for active/hover states.
 */
function chainIconSvg(locked: boolean): string {
  return locked ? icon('lockClosed') : icon('lockOpen');
}
