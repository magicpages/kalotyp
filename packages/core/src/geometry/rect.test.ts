import { describe, expect, it } from 'vitest';
import {
  clampRectInside,
  pointInRect,
  rectBottom,
  rectCenter,
  rectFromPoints,
  rectRight,
  rectsEqual,
  roundRect,
  translateClampedRect,
} from './rect.js';

describe('rectFromPoints', () => {
  it('produces a rect from two corner points regardless of order', () => {
    const a = rectFromPoints({ x: 10, y: 20 }, { x: 50, y: 70 });
    const b = rectFromPoints({ x: 50, y: 70 }, { x: 10, y: 20 });
    expect(a).toEqual({ x: 10, y: 20, width: 40, height: 50 });
    expect(rectsEqual(a, b)).toBe(true);
  });

  it('returns a zero-area rect for two identical points', () => {
    const r = rectFromPoints({ x: 5, y: 5 }, { x: 5, y: 5 });
    expect(r).toEqual({ x: 5, y: 5, width: 0, height: 0 });
  });
});

describe('rectRight / rectBottom / rectCenter', () => {
  it('returns the right and bottom edges and the center', () => {
    const r = { x: 10, y: 20, width: 100, height: 200 };
    expect(rectRight(r)).toBe(110);
    expect(rectBottom(r)).toBe(220);
    expect(rectCenter(r)).toEqual({ x: 60, y: 120 });
  });
});

describe('pointInRect', () => {
  const r = { x: 0, y: 0, width: 10, height: 10 };
  it('returns true on the inside', () => {
    expect(pointInRect({ x: 5, y: 5 }, r)).toBe(true);
  });
  it('treats the boundary as inside', () => {
    expect(pointInRect({ x: 0, y: 0 }, r)).toBe(true);
    expect(pointInRect({ x: 10, y: 10 }, r)).toBe(true);
  });
  it('returns false outside', () => {
    expect(pointInRect({ x: -1, y: 5 }, r)).toBe(false);
    expect(pointInRect({ x: 5, y: 11 }, r)).toBe(false);
  });
});

describe('clampRectInside', () => {
  const bounds = { x: 0, y: 0, width: 100, height: 100 };

  it('returns the rect unchanged when it already fits', () => {
    const r = { x: 10, y: 10, width: 30, height: 30 };
    expect(clampRectInside(r, bounds)).toEqual(r);
  });

  it('translates the rect inward when it overflows the right/bottom', () => {
    const r = { x: 80, y: 90, width: 30, height: 30 };
    expect(clampRectInside(r, bounds)).toEqual({ x: 70, y: 70, width: 30, height: 30 });
  });

  it('translates the rect inward when it overflows the left/top', () => {
    const r = { x: -10, y: -20, width: 30, height: 30 };
    expect(clampRectInside(r, bounds)).toEqual({ x: 0, y: 0, width: 30, height: 30 });
  });

  it('shrinks the rect to fit when it is larger than the bounds', () => {
    const r = { x: -10, y: -10, width: 200, height: 50 };
    expect(clampRectInside(r, bounds)).toEqual({ x: 0, y: 0, width: 100, height: 50 });
  });

  it('handles non-zero-origin bounds', () => {
    const offset = { x: 50, y: 50, width: 100, height: 100 };
    const r = { x: 10, y: 10, width: 30, height: 30 };
    expect(clampRectInside(r, offset)).toEqual({ x: 50, y: 50, width: 30, height: 30 });
  });
});

describe('translateClampedRect', () => {
  const bounds = { x: 0, y: 0, width: 100, height: 100 };

  it('moves the rect by (dx, dy) when nothing escapes the bounds', () => {
    const r = { x: 10, y: 10, width: 20, height: 20 };
    expect(translateClampedRect(r, 5, -5, bounds)).toEqual({
      x: 15,
      y: 5,
      width: 20,
      height: 20,
    });
  });

  it('clamps the translated rect when it would leave the bounds', () => {
    const r = { x: 80, y: 80, width: 30, height: 30 };
    expect(translateClampedRect(r, 50, 50, bounds)).toEqual({
      x: 70,
      y: 70,
      width: 30,
      height: 30,
    });
  });
});

describe('roundRect', () => {
  it('rounds every component to the nearest integer', () => {
    expect(roundRect({ x: 0.4, y: 0.6, width: 10.5, height: 9.49 })).toEqual({
      x: 0,
      y: 1,
      width: 11,
      height: 9,
    });
  });
});
