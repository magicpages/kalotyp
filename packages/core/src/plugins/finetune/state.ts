/**
 * Six tone adjustments stored as slider values in [-100, +100]; math
 * constants (gamma exponent, contrast multiplier, etc.) are computed
 * from these in `math.ts` at LUT-build time.
 */
export interface FinetuneState {
  readonly brightness: number;
  readonly contrast: number;
  readonly saturation: number;
  readonly exposure: number;
  readonly clarity: number;
  readonly gamma: number;
}

export const FINETUNE_MIN = -100;
export const FINETUNE_MAX = 100;
export const FINETUNE_STEP = 1;

export const DEFAULT_FINETUNE_STATE: FinetuneState = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  exposure: 0,
  clarity: 0,
  gamma: 0,
};

export type FinetuneKey = keyof FinetuneState;

export const FINETUNE_ADJUSTMENTS: readonly {
  readonly key: FinetuneKey;
  readonly label: string;
}[] = [
  { key: 'brightness', label: 'Brightness' },
  { key: 'contrast', label: 'Contrast' },
  { key: 'saturation', label: 'Saturation' },
  { key: 'exposure', label: 'Exposure' },
  { key: 'clarity', label: 'Clarity' },
  { key: 'gamma', label: 'Gamma' },
];

export function initialFinetuneState(): FinetuneState {
  return DEFAULT_FINETUNE_STATE;
}

export function isFinetuneNoOp(state: FinetuneState): boolean {
  return (
    state.brightness === 0 &&
    state.contrast === 0 &&
    state.saturation === 0 &&
    state.exposure === 0 &&
    state.clarity === 0 &&
    state.gamma === 0
  );
}

/** Update a single adjustment, clamped to the legal range. */
export function setFinetune(state: FinetuneState, key: FinetuneKey, value: number): FinetuneState {
  const next = clampSliderValue(value);
  if (state[key] === next) return state;
  return { ...state, [key]: next };
}

/** Reset a single adjustment to its default of 0. */
export function resetFinetune(state: FinetuneState, key: FinetuneKey): FinetuneState {
  if (state[key] === 0) return state;
  return { ...state, [key]: 0 };
}

/** Reset every adjustment to its default. */
export function resetAllFinetune(): FinetuneState {
  return DEFAULT_FINETUNE_STATE;
}

function clampSliderValue(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value <= FINETUNE_MIN) return FINETUNE_MIN;
  if (value >= FINETUNE_MAX) return FINETUNE_MAX;
  // Snap to slider step so programmatic setters round-trip through the input.
  return Math.round(value / FINETUNE_STEP) * FINETUNE_STEP;
}
