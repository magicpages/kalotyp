import {
  FREE_ANGLE_MAX,
  FREE_ANGLE_MIN,
  FREE_ANGLE_STEP,
  type RotateState,
  type SourceImage,
  type Store,
  type ViewportController,
  computeViewport,
  effectiveAngleDeg,
  largestInscribedRect,
  rotateClockwise,
  rotateCounterClockwise,
  setFreeAngle,
} from '@magicpages/kalotyp-core';
import { STAGE_PADDING_PX, buildPreviewCanvas, paintPreview } from '../../canvas/preview-canvas.js';

export interface MountRotateOptions {
  readonly stageHost: HTMLElement;
  readonly utilHost: HTMLElement;
  readonly source: SourceImage;
  readonly store: Store<RotateState>;
  /** Editor-level zoom + pan controller. Optional in jsdom tests. */
  readonly viewport?: ViewportController;
  /** Fires on quarter-turn / slider `change` / number `change` / reset — one undo per drag, not per tick. */
  readonly onCommit?: () => void;
}

export interface MountRotateHandle {
  destroy(): void;
}

// Same mask alpha as crop overlay so the "excluded region" cue reads consistently across plugins.
const MASK_FILL = 'rgba(0, 0, 0, 0.4)';
const INSCRIBED_OUTLINE = 'rgba(255, 255, 255, 0.95)';
const INSCRIBED_HALO = 'rgba(0, 0, 0, 0.45)';

export function mountRotateUtility(options: MountRotateOptions): MountRotateHandle {
  const { stageHost, utilHost, source, store, viewport: controller } = options;
  const commit = options.onCommit ?? noop;

  const preview = buildPreviewCanvas();
  stageHost.appendChild(preview.container);

  const panel = buildRotatePanel({
    onCounterClockwise: () => {
      store.set(rotateCounterClockwise(store.get()));
      commit();
    },
    onClockwise: () => {
      store.set(rotateClockwise(store.get()));
      commit();
    },
    onAngleInput: (deg) => store.set(setFreeAngle(store.get(), deg)),
    onAngleCommit: () => commit(),
    onAngleReset: () => {
      store.set(setFreeAngle(store.get(), 0));
      commit();
    },
  });
  utilHost.appendChild(panel.container);

  function paint(): void {
    const rect = preview.container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const state = store.get();
    const angleRad = (effectiveAngleDeg(state) * Math.PI) / 180;
    const sub90Deg = effectiveAngleDeg(state) - state.quarterTurns * 90;
    const isQuarterOnly = Math.abs(sub90Deg) < 1e-6;

    // Letterbox the rotated bounding box so the user sees the whole rotated source; the bake's crop
    // shows as the inscribed rect inside it.
    const c = Math.abs(Math.cos(angleRad));
    const s = Math.abs(Math.sin(angleRad));
    const boundsW = source.width * c + source.height * s;
    const boundsH = source.width * s + source.height * c;

    // Pass rotated bounds to computeViewport so fit-to-screen treats the rotated frame as intrinsic.
    const stageDims = { width: rect.width, height: rect.height, padding: STAGE_PADDING_PX };
    const rotatedBounds = { width: boundsW, height: boundsH };
    const viewport = controller
      ? controller.computeViewport(stageDims, rotatedBounds)
      : computeViewport(stageDims, rotatedBounds);
    const display = viewport.displayRect;
    const cx = display.x + display.width / 2;
    const cy = display.y + display.height / 2;

    // Quarter-only turns: inscribed equals the (axis-swapped) source.
    const inscribed = isQuarterOnly
      ? state.quarterTurns % 2 === 0
        ? { width: source.width, height: source.height }
        : { width: source.height, height: source.width }
      : largestInscribedRect(source, angleRad);

    paintPreview(preview.canvas, rect.width, rect.height, (ctx) => {
      // Rotated source centred on the displayRect, scaled to display px.
      const drawW = source.width * viewport.scale;
      const drawH = source.height * viewport.scale;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angleRad);
      ctx.drawImage(source.bitmap, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();

      const iw = inscribed.width * viewport.scale;
      const ih = inscribed.height * viewport.scale;
      const ix = cx - iw / 2;
      const iy = cy - ih / 2;

      // Mask outside the inscribed rect via even-odd clip. Skip on quarter-only turns (no crop).
      if (!isQuarterOnly) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, rect.width, rect.height);
        ctx.rect(ix, iy, iw, ih);
        ctx.clip('evenodd');
        ctx.fillStyle = MASK_FILL;
        ctx.fillRect(0, 0, rect.width, rect.height);
        ctx.restore();
      }

      ctx.save();
      ctx.lineWidth = 3;
      ctx.strokeStyle = INSCRIBED_HALO;
      ctx.strokeRect(ix + 0.5, iy + 0.5, iw - 1, ih - 1);
      ctx.lineWidth = 1;
      ctx.strokeStyle = INSCRIBED_OUTLINE;
      ctx.strokeRect(ix + 0.5, iy + 0.5, iw - 1, ih - 1);
      ctx.restore();
    });
  }

  function syncPanel(state: RotateState): void {
    if (panel.angleSlider.valueAsNumber !== state.freeAngle) {
      panel.angleSlider.valueAsNumber = state.freeAngle;
    }
    const formatted = formatAngleValue(state.freeAngle);
    if (panel.angleInput.value !== formatted) {
      panel.angleInput.value = formatted;
    }
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

  let rafScheduled = false;
  const unsubscribe = store.subscribe((next) => {
    syncPanel(next);
    if (rafScheduled) return;
    rafScheduled = true;
    requestAnimationFrame(() => {
      rafScheduled = false;
      paint();
    });
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

interface RotatePanelOptions {
  onCounterClockwise(): void;
  onClockwise(): void;
  /** Per-tick state mutation; no commit. */
  onAngleInput(deg: number): void;
  /** Drag-end commit boundary. */
  onAngleCommit(): void;
  onAngleReset(): void;
}

interface RotatePanel {
  container: HTMLDivElement;
  angleSlider: HTMLInputElement;
  angleInput: HTMLInputElement;
}

function buildRotatePanel(options: RotatePanelOptions): RotatePanel {
  const container = document.createElement('div');
  container.className = 'kalotyp-rotate-panel';
  container.setAttribute('role', 'group');
  container.setAttribute('aria-label', 'Rotate');

  const ccwButton = makeQuarterButton(
    'Rotate 90° counter-clockwise',
    '↺',
    options.onCounterClockwise,
  );
  const cwButton = makeQuarterButton('Rotate 90° clockwise', '↻', options.onClockwise);

  const angleSliderLabel = document.createElement('label');
  angleSliderLabel.className = 'kalotyp-rotate-slider-label';
  angleSliderLabel.textContent = 'Straighten';

  const angleSlider = document.createElement('input');
  angleSlider.type = 'range';
  angleSlider.className = 'kalotyp-rotate-slider';
  angleSlider.min = String(FREE_ANGLE_MIN);
  angleSlider.max = String(FREE_ANGLE_MAX);
  angleSlider.step = String(FREE_ANGLE_STEP);
  angleSlider.value = '0';
  angleSlider.setAttribute('aria-label', 'Straighten angle');
  angleSlider.addEventListener('input', () => options.onAngleInput(angleSlider.valueAsNumber));
  angleSlider.addEventListener('change', () => options.onAngleCommit());

  const angleInput = document.createElement('input');
  angleInput.type = 'number';
  angleInput.className = 'kalotyp-rotate-input';
  angleInput.min = String(FREE_ANGLE_MIN);
  angleInput.max = String(FREE_ANGLE_MAX);
  angleInput.step = String(FREE_ANGLE_STEP);
  angleInput.value = '0';
  angleInput.setAttribute('aria-label', 'Straighten angle in degrees');
  angleInput.addEventListener('change', () => {
    const value = angleInput.valueAsNumber;
    if (Number.isFinite(value)) {
      options.onAngleInput(value);
      options.onAngleCommit();
    }
  });

  const angleSuffix = document.createElement('span');
  angleSuffix.className = 'kalotyp-rotate-suffix';
  angleSuffix.setAttribute('aria-hidden', 'true');
  angleSuffix.textContent = '°';

  const resetButton = document.createElement('button');
  resetButton.type = 'button';
  resetButton.className = 'kalotyp-rotate-reset';
  resetButton.textContent = 'Reset';
  resetButton.addEventListener('click', options.onAngleReset);

  const quarterGroup = document.createElement('div');
  quarterGroup.className = 'kalotyp-rotate-row';
  quarterGroup.appendChild(ccwButton);
  quarterGroup.appendChild(cwButton);

  const angleInputGroup = document.createElement('span');
  angleInputGroup.className = 'kalotyp-rotate-input-group';
  angleInputGroup.appendChild(angleInput);
  angleInputGroup.appendChild(angleSuffix);

  const straightenGroup = document.createElement('div');
  straightenGroup.className = 'kalotyp-rotate-row kalotyp-rotate-slider-row';
  straightenGroup.appendChild(angleSliderLabel);
  straightenGroup.appendChild(angleSlider);
  straightenGroup.appendChild(angleInputGroup);
  straightenGroup.appendChild(resetButton);

  container.appendChild(quarterGroup);
  container.appendChild(straightenGroup);

  return { container, angleSlider, angleInput };
}

/** Whole numbers render as `15`; sub-unit values keep one decimal (`15.5`). */
function formatAngleValue(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(1);
}

function noop(): void {}

function makeQuarterButton(label: string, glyph: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'kalotyp-quarter-button';
  button.setAttribute('aria-label', label);
  button.title = label;
  button.textContent = glyph;
  button.addEventListener('click', onClick);
  return button;
}
