/**
 * Filters crop presets by aspect-ratio relative to 1. `landscape` keeps
 * ratio ≥ 1, `portrait` keeps ratio < 1; `undefined` ratios (Custom) and
 * unknown tokens stay visible.
 */
export type CropPresetFilter = 'landscape' | 'portrait';
export type CropPreset = readonly [number | undefined, string];

export function isPresetVisible(preset: CropPreset, filter: CropPresetFilter | undefined): boolean {
  const [ratio] = preset;
  if (ratio === undefined) return true;
  if (filter === undefined) return true;
  if (filter === 'landscape') return ratio >= 1;
  if (filter === 'portrait') return ratio < 1;
  return true;
}

export function filterPresets(
  presets: readonly CropPreset[],
  filter: CropPresetFilter | undefined,
): readonly CropPreset[] {
  return presets.filter((preset) => isPresetVisible(preset, filter));
}
