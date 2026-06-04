/**
 * Frame preset ids match Ghost's `frameOptions` identifiers directly so
 * a contract change is a state rename, not a translation table.
 */
export type FramePresetId =
  | 'none'
  | 'solidSharp'
  | 'solidRound'
  | 'lineSingle'
  | 'hook'
  | 'polaroid';

export const FRAME_PRESET_IDS: readonly FramePresetId[] = [
  'none',
  'solidSharp',
  'solidRound',
  'lineSingle',
  'hook',
  'polaroid',
];

export interface FramePreset {
  readonly id: FramePresetId;
  /** UI label. The Ghost adapter overrides these from `frameOptions[i][1]`. */
  readonly label: string;
  /** Whether the preset's colour can be customised by the user. */
  readonly acceptsColor: boolean;
  /** Default colour when `acceptsColor`. Polaroid defaults to white. */
  readonly defaultColor: string;
}

/** Six presets in Ghost's `frameOptions` order. Labels are English defaults; adapter localises. */
export const FRAME_PRESETS: readonly FramePreset[] = [
  {
    id: 'none',
    label: 'None',
    acceptsColor: false,
    defaultColor: '#000000',
  },
  {
    id: 'solidSharp',
    label: 'Mat Sharp',
    acceptsColor: true,
    defaultColor: '#000000',
  },
  {
    id: 'solidRound',
    label: 'Mat Round',
    acceptsColor: true,
    defaultColor: '#000000',
  },
  {
    id: 'lineSingle',
    label: 'Line Single',
    acceptsColor: true,
    defaultColor: '#000000',
  },
  {
    id: 'hook',
    label: 'Corner Hooks',
    acceptsColor: true,
    defaultColor: '#000000',
  },
  {
    id: 'polaroid',
    label: 'Polaroid',
    acceptsColor: true,
    defaultColor: '#ffffff',
  },
];

export interface FrameState {
  readonly presetId: FramePresetId;
  /** CSS hex colour. Used by every preset whose `acceptsColor` is true. */
  readonly color: string;
}

export const DEFAULT_FRAME_STATE: FrameState = {
  presetId: 'none',
  color: '#000000',
};

export function initialFrameState(): FrameState {
  return DEFAULT_FRAME_STATE;
}

export function isFrameNoOp(state: FrameState): boolean {
  return state.presetId === 'none';
}

export function setFramePreset(state: FrameState, presetId: FramePresetId): FrameState {
  if (state.presetId === presetId) return state;
  // Reset colour to the new preset's default iff the current colour
  // matches the previous preset's default (i.e. user hadn't customised it).
  const currentPreset = findFramePreset(state.presetId);
  const nextPreset = findFramePreset(presetId);
  if (!nextPreset) return { ...state, presetId };
  const wasOnDefault = currentPreset !== undefined && state.color === currentPreset.defaultColor;
  const nextColor = wasOnDefault ? nextPreset.defaultColor : state.color;
  return { presetId, color: nextColor };
}

export function setFrameColor(state: FrameState, color: string): FrameState {
  if (state.color === color) return state;
  return { ...state, color };
}

export function findFramePreset(id: FramePresetId): FramePreset | undefined {
  return FRAME_PRESETS.find((p) => p.id === id);
}
