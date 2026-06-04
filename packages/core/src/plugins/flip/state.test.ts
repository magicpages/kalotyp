import { describe, expect, it } from 'vitest';
import { initialFlipState, isFlipNoOp, toggleFlip } from './state.js';

describe('initialFlipState', () => {
  it('starts with both axes off', () => {
    expect(initialFlipState()).toEqual({ horizontal: false, vertical: false });
  });
});

describe('toggleFlip', () => {
  it('toggles the horizontal axis without touching vertical', () => {
    const next = toggleFlip({ horizontal: false, vertical: true }, 'horizontal');
    expect(next).toEqual({ horizontal: true, vertical: true });
  });

  it('toggles the vertical axis without touching horizontal', () => {
    const next = toggleFlip({ horizontal: true, vertical: false }, 'vertical');
    expect(next).toEqual({ horizontal: true, vertical: true });
  });

  it('is its own inverse', () => {
    const start = { horizontal: false, vertical: false };
    const there = toggleFlip(start, 'horizontal');
    const back = toggleFlip(there, 'horizontal');
    expect(back).toEqual(start);
  });
});

describe('isFlipNoOp', () => {
  it('detects the all-off state', () => {
    expect(isFlipNoOp({ horizontal: false, vertical: false })).toBe(true);
  });

  it('returns false when either axis is set', () => {
    expect(isFlipNoOp({ horizontal: true, vertical: false })).toBe(false);
    expect(isFlipNoOp({ horizontal: false, vertical: true })).toBe(false);
    expect(isFlipNoOp({ horizontal: true, vertical: true })).toBe(false);
  });
});
