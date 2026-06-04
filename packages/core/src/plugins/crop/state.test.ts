import { describe, expect, it } from 'vitest';
import type { CropPreset } from './preset-filter.js';
import { applyPresetByIndex, initialCropState } from './state.js';

const presets: readonly CropPreset[] = [
  [undefined, 'Custom'],
  [1, 'Square'],
  [16 / 9, '16:9'],
];

describe('initialCropState', () => {
  it('starts with the full-frame rect, no aspect ratio', () => {
    const state = initialCropState({
      imageSize: { width: 4000, height: 3000 },
      presets,
      filter: 'landscape',
    });
    expect(state.rect).toEqual({ x: 0, y: 0, width: 4000, height: 3000 });
    expect(state.aspectRatio).toBeUndefined();
    expect(state.activePresetIndex).toBe(0);
  });

  it('returns activePresetIndex = -1 when no Custom preset is present', () => {
    const state = initialCropState({
      imageSize: { width: 100, height: 100 },
      presets: [[1, 'Square']],
      filter: undefined,
    });
    expect(state.activePresetIndex).toBe(-1);
  });
});

describe('applyPresetByIndex', () => {
  const start = initialCropState({
    imageSize: { width: 4000, height: 3000 },
    presets,
    filter: 'landscape',
  });

  it('clears the aspect ratio when the Custom preset is chosen', () => {
    const withSquare = applyPresetByIndex(start, 1);
    const back = applyPresetByIndex(withSquare, 0);
    expect(back.aspectRatio).toBeUndefined();
    expect(back.activePresetIndex).toBe(0);
  });

  it('sets the aspect ratio and refits the rect when a ratio preset is chosen', () => {
    const next = applyPresetByIndex(start, 1);
    expect(next.aspectRatio).toBe(1);
    expect(next.rect.width).toBeCloseTo(3000);
    expect(next.rect.height).toBeCloseTo(3000);
    expect(next.rect.x).toBeCloseTo(500);
    expect(next.activePresetIndex).toBe(1);
  });

  it('refits to a 16:9 frame inside a 4:3 image', () => {
    const next = applyPresetByIndex(start, 2);
    expect(next.aspectRatio).toBeCloseTo(16 / 9);
    expect(next.rect.width).toBeCloseTo(4000);
    expect(next.rect.height).toBeCloseTo(2250);
  });

  it('returns the state unchanged when the index is out of range', () => {
    expect(applyPresetByIndex(start, 99)).toBe(start);
  });
});
