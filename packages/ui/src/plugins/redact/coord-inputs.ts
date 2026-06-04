/**
 * Per-region coordinate-input row for the redact plugin's keyboard
 * placement path. Same shape as the annotate
 * plugin's coord-inputs.ts but with one shape kind (rect) and four
 * fields (Left, Top, Width, Height).
 */

import type { RedactRegion } from '@magicpages/kalotyp-core';

export interface RedactCoordInputsOptions {
  onRegionChanged(region: RedactRegion): void;
}

export interface RedactCoordInputsHandle {
  readonly container: HTMLDivElement;
  /** Show inputs for the given region, or hide when null. */
  updateForRegion(region: RedactRegion | null): void;
  destroy(): void;
}

interface FieldSpec {
  readonly id: 'x' | 'y' | 'width' | 'height';
  readonly label: string;
  readonly min?: number;
}

const FIELDS: ReadonlyArray<FieldSpec> = [
  { id: 'x', label: 'Left' },
  { id: 'y', label: 'Top' },
  { id: 'width', label: 'Width', min: 1 },
  { id: 'height', label: 'Height', min: 1 },
];

export function buildRedactCoordInputs(options: RedactCoordInputsOptions): RedactCoordInputsHandle {
  const container = document.createElement('div');
  container.className = 'kalotyp-redact-coords';
  container.setAttribute('role', 'group');
  container.setAttribute('aria-label', 'Selected redaction position');
  container.hidden = true;

  let activeRegion: RedactRegion | null = null;
  const inputs = new Map<FieldSpec['id'], HTMLInputElement>();

  for (const spec of FIELDS) {
    const wrapper = document.createElement('label');
    wrapper.className = 'kalotyp-redact-coords-field';

    const labelSpan = document.createElement('span');
    labelSpan.className = 'kalotyp-redact-coords-label';
    labelSpan.textContent = spec.label;

    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'kalotyp-redact-coords-input';
    input.dataset.field = spec.id;
    input.step = '1';
    input.inputMode = 'numeric';
    if (spec.min !== undefined) input.min = String(spec.min);
    input.setAttribute('aria-label', `${spec.label} (pixels)`);
    input.addEventListener('change', onAnyInputChange);

    wrapper.appendChild(labelSpan);
    wrapper.appendChild(input);
    container.appendChild(wrapper);
    inputs.set(spec.id, input);
  }

  function syncValuesFromRegion(region: RedactRegion): void {
    const setVal = (id: FieldSpec['id'], value: number): void => {
      const el = inputs.get(id);
      if (!el) return;
      const next = String(Math.round(value));
      // Skip the assignment if the user is mid-edit on the input —
      // overwriting a focused, partially-typed value is the most
      // surprising thing an a11y helper can do.
      if (document.activeElement === el) return;
      if (el.value !== next) el.value = next;
    };
    setVal('x', region.x);
    setVal('y', region.y);
    setVal('width', region.width);
    setVal('height', region.height);
  }

  function onAnyInputChange(): void {
    if (!activeRegion) return;
    const x = readNumber('x');
    const y = readNumber('y');
    const width = readNumber('width');
    const height = readNumber('height');
    if (![x, y, width, height].every(Number.isFinite)) return;
    const next: RedactRegion = {
      ...activeRegion,
      x,
      y,
      width,
      height,
    };
    if (
      next.x === activeRegion.x &&
      next.y === activeRegion.y &&
      next.width === activeRegion.width &&
      next.height === activeRegion.height
    ) {
      return;
    }
    activeRegion = next;
    options.onRegionChanged(next);
  }

  function readNumber(id: FieldSpec['id']): number {
    const el = inputs.get(id);
    if (!el) return Number.NaN;
    return Math.round(el.valueAsNumber);
  }

  return {
    container,
    updateForRegion(region): void {
      if (!region) {
        activeRegion = null;
        container.hidden = true;
        return;
      }
      activeRegion = region;
      syncValuesFromRegion(region);
      container.hidden = false;
    },
    destroy(): void {
      container.replaceChildren();
      inputs.clear();
      container.remove();
    },
  };
}
