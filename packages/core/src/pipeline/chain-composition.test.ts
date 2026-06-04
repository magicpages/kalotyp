import { describe, expect, it } from 'vitest';
import type { Size } from '../geometry/rect.js';
import {
  effectiveAngleDeg,
  initialFlipState,
  initialResizeState,
  initialRotateState,
  largestInscribedRect,
  resolveOutputSize,
  rotateClockwise,
  setFreeAngle,
  setPercent,
  toggleFlip,
} from '../index.js';
import type { CropState, FlipState, ResizeState, RotateState } from '../index.js';

interface ChainStates {
  readonly crop: CropState;
  readonly rotate: RotateState;
  readonly flip: FlipState;
  readonly resize: ResizeState;
}

function dimsAfterCrop(state: CropState): Size {
  const rect = state.rect;
  return {
    width: Math.max(1, Math.round(rect.width)),
    height: Math.max(1, Math.round(rect.height)),
  };
}

function dimsAfterRotate(state: RotateState, upstream: Size): Size {
  const angleDeg = effectiveAngleDeg(state);
  const sub90 = angleDeg - state.quarterTurns * 90;
  const isQuarterOnly = Math.abs(sub90) < 1e-6;
  if (isQuarterOnly) {
    if (state.quarterTurns === 1 || state.quarterTurns === 3) {
      return { width: upstream.height, height: upstream.width };
    }
    return upstream;
  }
  const angleRad = (angleDeg * Math.PI) / 180;
  const inscribed = largestInscribedRect(upstream, angleRad);
  return {
    width: Math.max(1, Math.round(inscribed.width)),
    height: Math.max(1, Math.round(inscribed.height)),
  };
}

function dimsAfterFlip(_state: FlipState, upstream: Size): Size {
  return upstream;
}

function dimsAfterResize(state: ResizeState, upstream: Size): Size {
  return resolveOutputSize(state, upstream);
}

function dimsThroughChain(states: ChainStates): Size {
  const afterCrop = dimsAfterCrop(states.crop);
  const afterRotate = dimsAfterRotate(states.rotate, afterCrop);
  const afterFlip = dimsAfterFlip(states.flip, afterRotate);
  return dimsAfterResize(states.resize, afterFlip);
}

describe('canonical chain dimensions (crop → rotate → flip → resize)', () => {
  it('walks the canonical chain end-to-end: crop → rotate 45° → flip-H → resize 50%', () => {
    const states: ChainStates = {
      crop: {
        rect: { x: 0, y: 0, width: 800, height: 600 },
        aspectRatio: undefined,
        activePresetIndex: -1,
        presets: [],
        imageSize: { width: 1000, height: 1000 },
      },
      rotate: setFreeAngle(initialRotateState(), 45),
      flip: toggleFlip(initialFlipState(), 'horizontal'),
      resize: setPercent(initialResizeState(), 50),
    };

    expect(dimsAfterCrop(states.crop)).toEqual({ width: 800, height: 600 });
    expect(dimsAfterRotate(states.rotate, { width: 800, height: 600 })).toEqual({
      width: 485,
      height: 364,
    });
    expect(dimsAfterFlip(states.flip, { width: 485, height: 364 })).toEqual({
      width: 485,
      height: 364,
    });

    const final = dimsThroughChain(states);
    expect(final).toEqual({ width: 243, height: 182 });
  });

  it('produces exact integer outputs for resize 1000 → 33% (333), even after a no-op chain', () => {
    const states: ChainStates = {
      crop: {
        rect: { x: 0, y: 0, width: 1000, height: 1000 },
        aspectRatio: undefined,
        activePresetIndex: -1,
        presets: [],
        imageSize: { width: 1000, height: 1000 },
      },
      rotate: initialRotateState(),
      flip: initialFlipState(),
      resize: setPercent(initialResizeState(), 33.3),
    };
    expect(dimsThroughChain(states)).toEqual({ width: 333, height: 333 });
  });

  it('preserves dimensions through quarter-only rotations of a square source', () => {
    const square: ChainStates = {
      crop: {
        rect: { x: 0, y: 0, width: 500, height: 500 },
        aspectRatio: 1,
        activePresetIndex: -1,
        presets: [],
        imageSize: { width: 500, height: 500 },
      },
      rotate: rotateClockwise(initialRotateState()),
      flip: initialFlipState(),
      resize: initialResizeState(),
    };
    expect(dimsThroughChain(square)).toEqual({ width: 500, height: 500 });
  });

  it('swaps W and H on a single 90° turn for non-square sources', () => {
    const states: ChainStates = {
      crop: {
        rect: { x: 0, y: 0, width: 800, height: 400 },
        aspectRatio: undefined,
        activePresetIndex: -1,
        presets: [],
        imageSize: { width: 800, height: 400 },
      },
      rotate: rotateClockwise(initialRotateState()),
      flip: initialFlipState(),
      resize: initialResizeState(),
    };
    expect(dimsThroughChain(states)).toEqual({ width: 400, height: 800 });
  });
});

describe('rotation matrix composition (effectiveAngleDeg)', () => {
  it('composes quarter turns and the free angle additively', () => {
    let state = initialRotateState();
    state = rotateClockwise(state);
    state = setFreeAngle(state, 12);
    expect(effectiveAngleDeg(state)).toBe(102);
    state = rotateClockwise(state);
    expect(effectiveAngleDeg(state)).toBe(192);
  });

  it('the inscribed rect is invariant under adding 180° (half-turn invariance)', () => {
    const source = { width: 800, height: 600 };
    const a = (deg: number) => largestInscribedRect(source, (deg * Math.PI) / 180);
    const at30 = a(30);
    const at210 = a(210);
    expect(at30.width).toBeCloseTo(at210.width, 6);
    expect(at30.height).toBeCloseTo(at210.height, 6);
  });

  it('the inscribed rect at 30° matches the inscribed rect at -30° (sign symmetry)', () => {
    const source = { width: 800, height: 600 };
    const at30 = largestInscribedRect(source, (30 * Math.PI) / 180);
    const atMinus30 = largestInscribedRect(source, (-30 * Math.PI) / 180);
    expect(at30.width).toBeCloseTo(atMinus30.width, 6);
    expect(at30.height).toBeCloseTo(atMinus30.height, 6);
  });
});

describe('flip and rotate non-commutativity (matrix-level)', () => {
  it('flip-H then rotate(θ) ≠ rotate(θ) then flip-H for non-trivial θ', () => {
    const angle = (30 * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const probe = { x: 1, y: 1 };

    const afterFlipH = { x: -probe.x, y: probe.y };
    const flipThenRotate = {
      x: afterFlipH.x * cos - afterFlipH.y * sin,
      y: afterFlipH.x * sin + afterFlipH.y * cos,
    };

    const afterRotate = {
      x: probe.x * cos - probe.y * sin,
      y: probe.x * sin + probe.y * cos,
    };
    const rotateThenFlip = { x: -afterRotate.x, y: afterRotate.y };

    expect(Math.abs(flipThenRotate.x - rotateThenFlip.x)).toBeGreaterThan(1e-6);
  });

  it('the canonical chain (rotate then flip) is the only reachable composition', () => {
    const angle = (30 * Math.PI) / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const probe = { x: 1, y: 0 };
    const afterRotate = { x: probe.x * cos - probe.y * sin, y: probe.x * sin + probe.y * cos };
    const afterFlipThenRotate = { x: -afterRotate.x, y: afterRotate.y };
    expect(afterFlipThenRotate.x).toBeCloseTo(-cos, 6);
    expect(afterFlipThenRotate.y).toBeCloseTo(sin, 6);
  });
});
