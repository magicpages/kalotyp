import { describe, expect, it } from 'vitest';
import {
  effectivePercent,
  initialResizeState,
  isResizeNoOp,
  MAX_DIMENSION,
  resolveOutputSize,
  setHeightPx,
  setLockAspect,
  setPercent,
  setWidthPx,
} from './state.js';

describe('initialResizeState', () => {
  it('is a 1× scale on both axes with lock-aspect on', () => {
    expect(initialResizeState()).toEqual({ scaleX: 1, scaleY: 1, lockAspect: true });
  });
});

describe('resolveOutputSize', () => {
  it('produces exact integers; 1000 × 33.3% = 333', () => {
    const upstream = { width: 1000, height: 1000 };
    const state = setPercent(initialResizeState(), 33.3);
    const { width, height } = resolveOutputSize(state, upstream);
    expect(width).toBe(333);
    expect(height).toBe(333);
  });

  it('rounds half-pixels to the nearest integer', () => {
    const upstream = { width: 333, height: 333 };
    const state = setPercent(initialResizeState(), 50);
    const { width, height } = resolveOutputSize(state, upstream);
    expect(width).toBe(167);
    expect(height).toBe(167);
  });

  it('clamps to the soft maximum dimension', () => {
    const upstream = { width: 4000, height: 4000 };
    const state = setPercent(initialResizeState(), 500);
    const { width, height } = resolveOutputSize(state, upstream);
    expect(width).toBe(MAX_DIMENSION);
    expect(height).toBe(MAX_DIMENSION);
  });

  it('clamps below 1px to 1', () => {
    const upstream = { width: 100, height: 100 };
    const state = setPercent(initialResizeState(), 0);
    const { width } = resolveOutputSize(state, upstream);
    expect(width).toBe(1);
  });
});

describe('setWidthPx with lockAspect=true', () => {
  it('sets scaleY = scaleX from the typed pixel value', () => {
    const upstream = { width: 1000, height: 500 };
    const state = setWidthPx(initialResizeState(), 250, upstream);
    expect(state.scaleX).toBeCloseTo(0.25, 9);
    expect(state.scaleY).toBeCloseTo(0.25, 9);
    expect(resolveOutputSize(state, upstream)).toEqual({ width: 250, height: 125 });
  });
});

describe('setWidthPx with lockAspect=false', () => {
  it('only changes scaleX', () => {
    const upstream = { width: 1000, height: 500 };
    const start = setLockAspect(initialResizeState(), false);
    const next = setWidthPx(start, 250, upstream);
    expect(next.scaleX).toBeCloseTo(0.25, 9);
    expect(next.scaleY).toBe(start.scaleY);
  });
});

describe('setHeightPx', () => {
  it('mirrors setWidthPx on the vertical axis', () => {
    const upstream = { width: 1000, height: 500 };
    const state = setHeightPx(initialResizeState(), 1000, upstream);
    expect(state.scaleX).toBeCloseTo(2, 9);
    expect(state.scaleY).toBeCloseTo(2, 9);
    expect(resolveOutputSize(state, upstream)).toEqual({ width: 2000, height: 1000 });
  });
});

describe('setPercent', () => {
  it('applies uniformly to both axes regardless of lock', () => {
    const start = setLockAspect(initialResizeState(), false);
    const state = setPercent(start, 50);
    expect(state.scaleX).toBeCloseTo(0.5, 9);
    expect(state.scaleY).toBeCloseTo(0.5, 9);
  });

  it('treats non-positive percentages as a tiny floor (1%)', () => {
    expect(setPercent(initialResizeState(), -5).scaleX).toBeGreaterThan(0);
  });
});

describe('setLockAspect', () => {
  it('averages the two scales when re-locking from differing values', () => {
    const start = setLockAspect(initialResizeState(), false);
    const skewed = setHeightPx(setWidthPx(start, 1500, { width: 1000, height: 1000 }), 250, {
      width: 1000,
      height: 1000,
    });
    expect(skewed.scaleX).toBeCloseTo(1.5, 9);
    expect(skewed.scaleY).toBeCloseTo(0.25, 9);
    const relocked = setLockAspect(skewed, true);
    expect(relocked.scaleX).toBeCloseTo(0.875, 9);
    expect(relocked.scaleY).toBeCloseTo(0.875, 9);
  });

  it('is a no-op when the lock state is unchanged', () => {
    const start = initialResizeState();
    expect(setLockAspect(start, true)).toBe(start);
  });
});

describe('isResizeNoOp', () => {
  it('detects the identity scale', () => {
    expect(isResizeNoOp(initialResizeState())).toBe(true);
  });

  it('returns false for non-1 scales', () => {
    expect(isResizeNoOp(setPercent(initialResizeState(), 99))).toBe(false);
  });
});

describe('effectivePercent', () => {
  it('returns the larger of the two scales as a percent rounded to 1 decimal', () => {
    const skewed: import('./state.js').ResizeState = {
      scaleX: 0.4444,
      scaleY: 0.6789,
      lockAspect: false,
    };
    expect(effectivePercent(skewed)).toBeCloseTo(67.9, 1);
  });
});
