import { describe, expect, it } from 'vitest';
import { DEFAULT_FINETUNE_STATE } from '../finetune/state.js';
import {
  FILTER_PRESETS,
  type FilterPresetId,
  findActivePreset,
  finetuneStatesEqual,
} from './presets.js';

describe('FILTER_PRESETS', () => {
  it('starts with None (the identity preset)', () => {
    expect(FILTER_PRESETS[0]?.id).toBe('none');
    expect(FILTER_PRESETS[0]?.state).toBe(DEFAULT_FINETUNE_STATE);
  });

  it('contains seven entries (None + six labelled filters)', () => {
    expect(FILTER_PRESETS).toHaveLength(7);
  });

  it('every preset has a non-empty label', () => {
    for (const preset of FILTER_PRESETS) {
      expect(preset.label.length).toBeGreaterThan(0);
    }
  });

  it('every preset id is unique', () => {
    const ids = FILTER_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every preset state is within the legal slider range', () => {
    for (const preset of FILTER_PRESETS) {
      const { state } = preset;
      for (const value of Object.values(state)) {
        expect(value).toBeGreaterThanOrEqual(-100);
        expect(value).toBeLessThanOrEqual(100);
      }
    }
  });

  it('every named preset is structurally distinct from None', () => {
    for (const preset of FILTER_PRESETS) {
      if (preset.id === 'none') continue;
      expect(finetuneStatesEqual(preset.state, DEFAULT_FINETUNE_STATE)).toBe(false);
    }
  });

  it('every named preset is structurally distinct from every other named preset', () => {
    const named = FILTER_PRESETS.filter((p) => p.id !== 'none');
    for (let i = 0; i < named.length; i++) {
      for (let j = i + 1; j < named.length; j++) {
        const a = named[i];
        const b = named[j];
        if (!a || !b) continue;
        expect(finetuneStatesEqual(a.state, b.state)).toBe(false);
      }
    }
  });
});

describe('finetuneStatesEqual', () => {
  it('is true for the same reference', () => {
    expect(finetuneStatesEqual(DEFAULT_FINETUNE_STATE, DEFAULT_FINETUNE_STATE)).toBe(true);
  });

  it('is true for structurally-equal copies', () => {
    expect(finetuneStatesEqual(DEFAULT_FINETUNE_STATE, { ...DEFAULT_FINETUNE_STATE })).toBe(true);
  });

  it('is false when any single field differs', () => {
    const fields: Array<keyof typeof DEFAULT_FINETUNE_STATE> = [
      'brightness',
      'contrast',
      'saturation',
      'exposure',
      'clarity',
      'gamma',
    ];
    for (const field of fields) {
      const mutated = { ...DEFAULT_FINETUNE_STATE, [field]: 1 };
      expect(finetuneStatesEqual(DEFAULT_FINETUNE_STATE, mutated)).toBe(false);
    }
  });
});

describe('findActivePreset', () => {
  it('returns None for the default state', () => {
    expect(findActivePreset(DEFAULT_FINETUNE_STATE)?.id).toBe('none');
  });

  it('returns the matching preset for an exact preset state', () => {
    const ids: FilterPresetId[] = ['vivid', 'mono', 'soft', 'punch', 'mute', 'bright'];
    for (const id of ids) {
      const preset = FILTER_PRESETS.find((p) => p.id === id);
      if (!preset) throw new Error(`preset ${id} missing`);
      expect(findActivePreset(preset.state)?.id).toBe(id);
    }
  });

  it('returns undefined for a state between presets', () => {
    const vivid = FILTER_PRESETS.find((p) => p.id === 'vivid');
    if (!vivid) throw new Error('vivid preset missing');
    const nudged = { ...vivid.state, saturation: vivid.state.saturation - 1 };
    expect(findActivePreset(nudged)).toBeUndefined();
  });
});
