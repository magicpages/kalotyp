/**
 * Curated `FinetuneState` shapes that one-click set the six tone numbers.
 * The filter tab is a UI view over the finetune store: clicking a preset
 * here is identical to dragging the matching sliders in finetune.
 */
import { DEFAULT_FINETUNE_STATE, type FinetuneState } from '../finetune/state.js';

export type FilterPresetId = 'none' | 'vivid' | 'mono' | 'soft' | 'punch' | 'mute' | 'bright';

export interface FilterPreset {
  readonly id: FilterPresetId;
  readonly label: string;
  readonly state: FinetuneState;
}

/** The seven presets in display order. `none` is the identity / off state. */
export const FILTER_PRESETS: readonly FilterPreset[] = [
  {
    id: 'none',
    label: 'None',
    state: DEFAULT_FINETUNE_STATE,
  },
  {
    id: 'vivid',
    label: 'Vivid',
    state: {
      brightness: 0,
      contrast: 10,
      saturation: 40,
      exposure: 0,
      clarity: 5,
      gamma: 0,
    },
  },
  {
    id: 'mono',
    label: 'Mono',
    // -100 saturation is bit-exact grayscale via Rec. 709 luminance.
    state: {
      brightness: 0,
      contrast: 15,
      saturation: -100,
      exposure: 0,
      clarity: 0,
      gamma: 0,
    },
  },
  {
    id: 'soft',
    label: 'Soft',
    state: {
      brightness: 5,
      contrast: -10,
      saturation: 0,
      exposure: 0,
      clarity: -25,
      gamma: 0,
    },
  },
  {
    id: 'punch',
    label: 'Punch',
    state: {
      brightness: 0,
      contrast: 30,
      saturation: 5,
      exposure: 0,
      clarity: 25,
      gamma: 0,
    },
  },
  {
    id: 'mute',
    label: 'Mute',
    state: {
      brightness: 0,
      contrast: 5,
      saturation: -50,
      exposure: 0,
      clarity: -5,
      gamma: 0,
    },
  },
  {
    id: 'bright',
    label: 'Bright',
    state: {
      brightness: 5,
      contrast: 5,
      saturation: 0,
      exposure: 15,
      clarity: 0,
      gamma: 0,
    },
  },
];

/** Structural equality across the six finetune fields. */
export function finetuneStatesEqual(a: FinetuneState, b: FinetuneState): boolean {
  return (
    a.brightness === b.brightness &&
    a.contrast === b.contrast &&
    a.saturation === b.saturation &&
    a.exposure === b.exposure &&
    a.clarity === b.clarity &&
    a.gamma === b.gamma
  );
}

/** Preset whose state matches `state` exactly, or `undefined` if between presets. */
export function findActivePreset(state: FinetuneState): FilterPreset | undefined {
  for (const preset of FILTER_PRESETS) {
    if (finetuneStatesEqual(preset.state, state)) return preset;
  }
  return undefined;
}
