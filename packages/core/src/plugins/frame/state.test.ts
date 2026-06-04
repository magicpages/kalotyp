import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FRAME_STATE,
  FRAME_PRESET_IDS,
  FRAME_PRESETS,
  findFramePreset,
  initialFrameState,
  isFrameNoOp,
  setFrameColor,
  setFramePreset,
} from './state.js';

describe('frame state', () => {
  it('initial state is no-op (presetId === none)', () => {
    const state = initialFrameState();
    expect(state).toEqual(DEFAULT_FRAME_STATE);
    expect(isFrameNoOp(state)).toBe(true);
  });

  it('FRAME_PRESETS lists exactly the six Ghost identifiers in order', () => {
    expect(FRAME_PRESETS.map((p) => p.id)).toEqual([
      'none',
      'solidSharp',
      'solidRound',
      'lineSingle',
      'hook',
      'polaroid',
    ]);
    expect([...FRAME_PRESET_IDS]).toEqual(FRAME_PRESETS.map((p) => p.id));
  });

  it('every preset has a label, acceptsColor flag, and default colour', () => {
    for (const preset of FRAME_PRESETS) {
      expect(typeof preset.label).toBe('string');
      expect(preset.label.length).toBeGreaterThan(0);
      expect(typeof preset.acceptsColor).toBe('boolean');
      expect(preset.defaultColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('"none" is the only preset that does not accept colour customisation', () => {
    const colourful = FRAME_PRESETS.filter((p) => p.acceptsColor);
    expect(colourful.map((p) => p.id)).toEqual([
      'solidSharp',
      'solidRound',
      'lineSingle',
      'hook',
      'polaroid',
    ]);
  });

  it('setFramePreset switches preset and resets colour to the new default if the user was on the old default', () => {
    let state = initialFrameState();
    state = setFramePreset(state, 'polaroid');
    expect(state.color).toBe('#ffffff');
    expect(state.presetId).toBe('polaroid');
  });

  it('setFramePreset preserves a customised colour across preset changes', () => {
    let state = initialFrameState();
    state = setFramePreset(state, 'solidSharp');
    state = setFrameColor(state, '#ff0000');
    state = setFramePreset(state, 'lineSingle');
    expect(state.color).toBe('#ff0000');
    expect(state.presetId).toBe('lineSingle');
  });

  it('setFramePreset on the same preset returns the same reference', () => {
    const state = initialFrameState();
    expect(setFramePreset(state, state.presetId)).toBe(state);
  });

  it('setFrameColor on the same colour returns the same reference', () => {
    const state = initialFrameState();
    expect(setFrameColor(state, state.color)).toBe(state);
  });

  it('findFramePreset returns the matching preset or undefined', () => {
    expect(findFramePreset('polaroid')?.id).toBe('polaroid');
    // @ts-expect-error — testing the undefined branch
    expect(findFramePreset('not-a-preset')).toBeUndefined();
  });

  it('isFrameNoOp is true only for "none"', () => {
    expect(isFrameNoOp({ presetId: 'none', color: '#000000' })).toBe(true);
    expect(isFrameNoOp({ presetId: 'solidSharp', color: '#000000' })).toBe(false);
    expect(isFrameNoOp({ presetId: 'polaroid', color: '#ffffff' })).toBe(false);
  });
});
