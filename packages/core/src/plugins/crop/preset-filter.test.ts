import { describe, expect, it } from 'vitest';
import { type CropPreset, filterPresets, isPresetVisible } from './preset-filter.js';

const ghostPresetList: readonly CropPreset[] = [
  [undefined, 'Custom'],
  [1, 'Square'],
  [2, '2:1'],
  [1.5, '3:2'],
  [4 / 3, '4:3'],
  [1.6, '16:10'],
  [16 / 9, '16:9'],
  [0.5, '1:2'],
  [2 / 3, '2:3'],
  [0.75, '3:4'],
  [10 / 16, '10:16'],
  [9 / 16, '9:16'],
];

describe('isPresetVisible', () => {
  it('always shows the undefined (Custom) preset', () => {
    expect(isPresetVisible([undefined, 'Custom'], 'landscape')).toBe(true);
    expect(isPresetVisible([undefined, 'Custom'], 'portrait')).toBe(true);
    expect(isPresetVisible([undefined, 'Custom'], undefined)).toBe(true);
  });

  it('shows ratio >= 1 for landscape', () => {
    expect(isPresetVisible([1, 'Square'], 'landscape')).toBe(true);
    expect(isPresetVisible([16 / 9, '16:9'], 'landscape')).toBe(true);
    expect(isPresetVisible([0.5, '1:2'], 'landscape')).toBe(false);
  });

  it('shows ratio < 1 for portrait', () => {
    expect(isPresetVisible([0.5, '1:2'], 'portrait')).toBe(true);
    expect(isPresetVisible([1, 'Square'], 'portrait')).toBe(false);
    expect(isPresetVisible([16 / 9, '16:9'], 'portrait')).toBe(false);
  });

  it('shows everything when filter is undefined', () => {
    expect(isPresetVisible([16 / 9, '16:9'], undefined)).toBe(true);
    expect(isPresetVisible([9 / 16, '9:16'], undefined)).toBe(true);
  });
});

describe('filterPresets', () => {
  it('returns the seven landscape-friendly presets for "landscape"', () => {
    const visible = filterPresets(ghostPresetList, 'landscape');
    expect(visible.map(([, label]) => label)).toEqual([
      'Custom',
      'Square',
      '2:1',
      '3:2',
      '4:3',
      '16:10',
      '16:9',
    ]);
  });

  it('returns the five portrait-friendly presets for "portrait"', () => {
    const visible = filterPresets(ghostPresetList, 'portrait');
    expect(visible.map(([, label]) => label)).toEqual([
      'Custom',
      '1:2',
      '2:3',
      '3:4',
      '10:16',
      '9:16',
    ]);
  });

  it('returns every preset when filter is undefined', () => {
    expect(filterPresets(ghostPresetList, undefined)).toHaveLength(ghostPresetList.length);
  });

  it('preserves the input order in the visible subset', () => {
    const visible = filterPresets(ghostPresetList, 'landscape');
    expect(visible[0]).toBe(ghostPresetList[0]);
    expect(visible[1]).toBe(ghostPresetList[1]);
  });
});
