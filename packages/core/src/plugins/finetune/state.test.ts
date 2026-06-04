import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FINETUNE_STATE,
  FINETUNE_ADJUSTMENTS,
  FINETUNE_MAX,
  FINETUNE_MIN,
  initialFinetuneState,
  isFinetuneNoOp,
  resetAllFinetune,
  resetFinetune,
  setFinetune,
} from './state.js';

describe('initialFinetuneState', () => {
  it('returns the all-zero default', () => {
    expect(initialFinetuneState()).toEqual(DEFAULT_FINETUNE_STATE);
  });

  it('is referentially the canonical default constant', () => {
    expect(initialFinetuneState()).toBe(DEFAULT_FINETUNE_STATE);
  });
});

describe('FINETUNE_ADJUSTMENTS', () => {
  it('lists the six adjustments in the documented order', () => {
    expect(FINETUNE_ADJUSTMENTS.map((a) => a.key)).toEqual([
      'brightness',
      'contrast',
      'saturation',
      'exposure',
      'clarity',
      'gamma',
    ]);
  });

  it('every adjustment has a non-empty label', () => {
    for (const adj of FINETUNE_ADJUSTMENTS) {
      expect(adj.label.length).toBeGreaterThan(0);
    }
  });
});

describe('isFinetuneNoOp', () => {
  it('is true for the default state', () => {
    expect(isFinetuneNoOp(DEFAULT_FINETUNE_STATE)).toBe(true);
  });

  it('is false when any single adjustment is non-zero', () => {
    expect(isFinetuneNoOp({ ...DEFAULT_FINETUNE_STATE, brightness: 1 })).toBe(false);
    expect(isFinetuneNoOp({ ...DEFAULT_FINETUNE_STATE, contrast: -1 })).toBe(false);
    expect(isFinetuneNoOp({ ...DEFAULT_FINETUNE_STATE, saturation: 50 })).toBe(false);
    expect(isFinetuneNoOp({ ...DEFAULT_FINETUNE_STATE, exposure: 100 })).toBe(false);
    expect(isFinetuneNoOp({ ...DEFAULT_FINETUNE_STATE, clarity: -100 })).toBe(false);
    expect(isFinetuneNoOp({ ...DEFAULT_FINETUNE_STATE, gamma: 1 })).toBe(false);
  });
});

describe('setFinetune', () => {
  it('updates a single key without touching the others', () => {
    const next = setFinetune(DEFAULT_FINETUNE_STATE, 'brightness', 25);
    expect(next).toEqual({ ...DEFAULT_FINETUNE_STATE, brightness: 25 });
  });

  it('clamps below the minimum', () => {
    const next = setFinetune(DEFAULT_FINETUNE_STATE, 'contrast', -250);
    expect(next.contrast).toBe(FINETUNE_MIN);
  });

  it('clamps above the maximum', () => {
    const next = setFinetune(DEFAULT_FINETUNE_STATE, 'gamma', 250);
    expect(next.gamma).toBe(FINETUNE_MAX);
  });

  it('rejects non-finite input by treating it as zero', () => {
    expect(setFinetune(DEFAULT_FINETUNE_STATE, 'exposure', Number.NaN).exposure).toBe(0);
    expect(setFinetune(DEFAULT_FINETUNE_STATE, 'exposure', Number.POSITIVE_INFINITY).exposure).toBe(
      FINETUNE_MAX,
    );
    expect(setFinetune(DEFAULT_FINETUNE_STATE, 'exposure', Number.NEGATIVE_INFINITY).exposure).toBe(
      FINETUNE_MIN,
    );
  });

  it('rounds to the slider step', () => {
    expect(setFinetune(DEFAULT_FINETUNE_STATE, 'brightness', 25.4).brightness).toBe(25);
    expect(setFinetune(DEFAULT_FINETUNE_STATE, 'brightness', 25.7).brightness).toBe(26);
  });

  it('returns the same reference when the value would not change', () => {
    const seed = setFinetune(DEFAULT_FINETUNE_STATE, 'saturation', 10);
    const same = setFinetune(seed, 'saturation', 10);
    expect(same).toBe(seed);
  });
});

describe('resetFinetune', () => {
  it('zeroes a single adjustment without touching the others', () => {
    const seed = setFinetune(DEFAULT_FINETUNE_STATE, 'contrast', 30);
    const seeded = setFinetune(seed, 'gamma', -25);
    const reset = resetFinetune(seeded, 'contrast');
    expect(reset).toEqual({ ...DEFAULT_FINETUNE_STATE, gamma: -25 });
  });

  it('returns the same reference when already zero', () => {
    expect(resetFinetune(DEFAULT_FINETUNE_STATE, 'brightness')).toBe(DEFAULT_FINETUNE_STATE);
  });
});

describe('resetAllFinetune', () => {
  it('returns the canonical default', () => {
    expect(resetAllFinetune()).toBe(DEFAULT_FINETUNE_STATE);
  });
});
