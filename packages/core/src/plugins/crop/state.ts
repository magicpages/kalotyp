import type { Rect, Size } from '../../geometry/rect.js';
import { fitRectToBoundsWithRatio } from './aspect-ratio.js';
import type { CropPreset, CropPresetFilter } from './preset-filter.js';

export interface CropState {
  /** Crop rectangle in image-space pixels. */
  readonly rect: Rect;
  /** Active aspect-ratio constraint (image w/h), or `undefined` for free. */
  readonly aspectRatio: number | undefined;
  /** Index into `presets`, or `-1` if no preset is active. */
  readonly activePresetIndex: number;
  /** Visible presets after applying `cropSelectPresetFilter`. */
  readonly presets: readonly CropPreset[];
  /** Image dimensions, in pixels. The bounds the crop can move within. */
  readonly imageSize: Size;
}

export interface InitialCropStateInput {
  readonly imageSize: Size;
  readonly presets: readonly CropPreset[];
  readonly filter: CropPresetFilter | undefined;
}

/** Full-frame crop, "Custom" preset active. */
export function initialCropState(input: InitialCropStateInput): CropState {
  const bounds: Rect = { x: 0, y: 0, width: input.imageSize.width, height: input.imageSize.height };
  return {
    rect: bounds,
    aspectRatio: undefined,
    activePresetIndex: findCustomIndex(input.presets),
    presets: input.presets,
    imageSize: input.imageSize,
  };
}

export function applyPresetByIndex(state: CropState, presetIndex: number): CropState {
  const preset = state.presets[presetIndex];
  if (!preset) return state;
  const [ratio] = preset;
  if (ratio === undefined) {
    return { ...state, aspectRatio: undefined, activePresetIndex: presetIndex };
  }
  const bounds: Rect = {
    x: 0,
    y: 0,
    width: state.imageSize.width,
    height: state.imageSize.height,
  };
  const fitted = fitRectToBoundsWithRatio(bounds, ratio);
  return { ...state, rect: fitted, aspectRatio: ratio, activePresetIndex: presetIndex };
}

function findCustomIndex(presets: readonly CropPreset[]): number {
  return presets.findIndex(([ratio]) => ratio === undefined);
}
