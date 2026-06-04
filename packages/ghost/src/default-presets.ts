import type { CropPreset } from './contract.js';

/**
 * The 12-entry preset list Ghost always passes (`docs/ghost-contract.md`
 * §3). Used as a fallback when a non-Ghost caller invokes our API without
 * supplying `cropSelectPresetOptions`. Order and labels match Ghost's
 * source verbatim.
 */
export const DEFAULT_CROP_PRESETS: readonly CropPreset[] = [
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
