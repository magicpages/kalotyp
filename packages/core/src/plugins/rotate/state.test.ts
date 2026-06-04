import { describe, expect, it } from 'vitest';
import {
  effectiveAngleDeg,
  FREE_ANGLE_MAX,
  FREE_ANGLE_MIN,
  initialRotateState,
  isRotateNoOp,
  rotateClockwise,
  rotateCounterClockwise,
  setFreeAngle,
} from './state.js';

describe('initialRotateState', () => {
  it('starts at the identity (no quarter turns, no free angle)', () => {
    expect(initialRotateState()).toEqual({ quarterTurns: 0, freeAngle: 0 });
  });
});

describe('rotateClockwise / rotateCounterClockwise', () => {
  it('cycles forward through 0 → 1 → 2 → 3 → 0', () => {
    let state = initialRotateState();
    state = rotateClockwise(state);
    expect(state.quarterTurns).toBe(1);
    state = rotateClockwise(state);
    expect(state.quarterTurns).toBe(2);
    state = rotateClockwise(state);
    expect(state.quarterTurns).toBe(3);
    state = rotateClockwise(state);
    expect(state.quarterTurns).toBe(0);
  });

  it('cycles backward through 0 → 3 → 2 → 1 → 0', () => {
    let state = initialRotateState();
    state = rotateCounterClockwise(state);
    expect(state.quarterTurns).toBe(3);
    state = rotateCounterClockwise(state);
    expect(state.quarterTurns).toBe(2);
    state = rotateCounterClockwise(state);
    expect(state.quarterTurns).toBe(1);
    state = rotateCounterClockwise(state);
    expect(state.quarterTurns).toBe(0);
  });

  it('preserves the free-angle when stepping by 90°', () => {
    const start = setFreeAngle(initialRotateState(), 12.3);
    expect(rotateClockwise(start).freeAngle).toBe(12.3);
  });
});

describe('setFreeAngle', () => {
  it('clamps to [-45, 45]', () => {
    expect(setFreeAngle(initialRotateState(), -90).freeAngle).toBe(FREE_ANGLE_MIN);
    expect(setFreeAngle(initialRotateState(), 90).freeAngle).toBe(FREE_ANGLE_MAX);
  });

  it('snaps to 0.1° steps', () => {
    expect(setFreeAngle(initialRotateState(), 12.346).freeAngle).toBe(12.3);
    expect(setFreeAngle(initialRotateState(), -7.04).freeAngle).toBe(-7.0);
  });
});

describe('effectiveAngleDeg', () => {
  it('combines quarter turns with the free angle', () => {
    expect(effectiveAngleDeg({ quarterTurns: 0, freeAngle: 12.5 })).toBe(12.5);
    expect(effectiveAngleDeg({ quarterTurns: 1, freeAngle: 0 })).toBe(90);
    expect(effectiveAngleDeg({ quarterTurns: 2, freeAngle: -3 })).toBe(177);
    expect(effectiveAngleDeg({ quarterTurns: 3, freeAngle: 5 })).toBe(275);
  });
});

describe('isRotateNoOp', () => {
  it('detects the identity state', () => {
    expect(isRotateNoOp(initialRotateState())).toBe(true);
  });

  it('returns false when quarter turns are non-zero', () => {
    expect(isRotateNoOp({ quarterTurns: 1, freeAngle: 0 })).toBe(false);
  });

  it('returns false when the free angle is non-zero', () => {
    expect(isRotateNoOp({ quarterTurns: 0, freeAngle: 0.5 })).toBe(false);
  });
});
