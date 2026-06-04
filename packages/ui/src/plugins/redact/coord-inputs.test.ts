/* @vitest-environment jsdom */
import type { RedactRegion } from '@magicpages/kalotyp-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRedactCoordInputs } from './coord-inputs.js';

function makeRegion(overrides: Partial<RedactRegion> = {}): RedactRegion {
  return {
    id: 'r_1',
    x: 100,
    y: 100,
    width: 200,
    height: 150,
    mode: 'pixelate',
    color: '#000000',
    ...overrides,
  };
}

beforeEach(() => {
  document.body.replaceChildren();
});

afterEach(() => {
  document.body.replaceChildren();
});

describe('redact coord-inputs', () => {
  it('hides the row when no region is supplied', () => {
    const handle = buildRedactCoordInputs({ onRegionChanged: () => {} });
    document.body.appendChild(handle.container);
    expect(handle.container.hidden).toBe(true);
  });

  it('shows the row and pre-fills inputs when a region is supplied', () => {
    const handle = buildRedactCoordInputs({ onRegionChanged: () => {} });
    document.body.appendChild(handle.container);
    handle.updateForRegion(makeRegion({ x: 10, y: 20, width: 30, height: 40 }));
    expect(handle.container.hidden).toBe(false);
    const inputs = handle.container.querySelectorAll<HTMLInputElement>(
      '.kalotyp-redact-coords-input',
    );
    const byField = new Map<string, HTMLInputElement>();
    for (const el of Array.from(inputs)) byField.set(el.dataset.field ?? '', el);
    expect(byField.get('x')?.value).toBe('10');
    expect(byField.get('y')?.value).toBe('20');
    expect(byField.get('width')?.value).toBe('30');
    expect(byField.get('height')?.value).toBe('40');
  });

  it('emits onRegionChanged with the typed values on commit', () => {
    const callback = vi.fn();
    const handle = buildRedactCoordInputs({ onRegionChanged: callback });
    document.body.appendChild(handle.container);
    handle.updateForRegion(makeRegion());
    const widthInput = handle.container.querySelector<HTMLInputElement>(
      '.kalotyp-redact-coords-input[data-field="width"]',
    );
    if (!widthInput) throw new Error('width input missing');
    widthInput.value = '320';
    widthInput.dispatchEvent(new Event('change', { bubbles: true }));
    expect(callback).toHaveBeenCalledOnce();
    const arg = callback.mock.calls[0]?.[0] as RedactRegion;
    expect(arg.width).toBe(320);
    // Other fields preserve their state.
    expect(arg.x).toBe(100);
    expect(arg.height).toBe(150);
  });

  it('hides the row again when null is supplied', () => {
    const handle = buildRedactCoordInputs({ onRegionChanged: () => {} });
    document.body.appendChild(handle.container);
    handle.updateForRegion(makeRegion());
    expect(handle.container.hidden).toBe(false);
    handle.updateForRegion(null);
    expect(handle.container.hidden).toBe(true);
  });

  it('does not emit when no field actually changed', () => {
    const callback = vi.fn();
    const handle = buildRedactCoordInputs({ onRegionChanged: callback });
    document.body.appendChild(handle.container);
    const region = makeRegion();
    handle.updateForRegion(region);
    const xInput = handle.container.querySelector<HTMLInputElement>(
      '.kalotyp-redact-coords-input[data-field="x"]',
    );
    if (!xInput) throw new Error('x input missing');
    // Trigger a change event without modifying the value.
    xInput.dispatchEvent(new Event('change', { bubbles: true }));
    expect(callback).not.toHaveBeenCalled();
  });
});
