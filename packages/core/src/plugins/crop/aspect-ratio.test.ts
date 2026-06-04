import { describe, expect, it } from 'vitest';
import { applyAspectRatio, fitRectToBoundsWithRatio } from './aspect-ratio.js';

describe('fitRectToBoundsWithRatio', () => {
  it('fills a wider-than-target bounds by maxing height (centered)', () => {
    const bounds = { x: 0, y: 0, width: 1000, height: 500 };
    const r = fitRectToBoundsWithRatio(bounds, 1);
    expect(r.width).toBeCloseTo(500);
    expect(r.height).toBeCloseTo(500);
    expect(r.x).toBeCloseTo(250);
    expect(r.y).toBeCloseTo(0);
  });

  it('fills a taller-than-target bounds by maxing width (centered)', () => {
    const bounds = { x: 0, y: 0, width: 500, height: 1000 };
    const r = fitRectToBoundsWithRatio(bounds, 1);
    expect(r.width).toBeCloseTo(500);
    expect(r.height).toBeCloseTo(500);
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo(250);
  });

  it('returns a 16:9 rect inside a 4:3 frame', () => {
    const r = fitRectToBoundsWithRatio({ x: 0, y: 0, width: 4000, height: 3000 }, 16 / 9);
    expect(r.width).toBeCloseTo(4000);
    expect(r.height).toBeCloseTo(2250);
    expect(r.y).toBeCloseTo(375);
  });

  it('handles non-zero-origin bounds', () => {
    const r = fitRectToBoundsWithRatio({ x: 100, y: 50, width: 1000, height: 500 }, 1);
    expect(r.x).toBeCloseTo(350);
    expect(r.y).toBeCloseTo(50);
  });

  it('returns a degenerate rect for a non-positive ratio', () => {
    const r = fitRectToBoundsWithRatio({ x: 0, y: 0, width: 100, height: 100 }, 0);
    expect(r.width).toBe(0);
    expect(r.height).toBe(0);
  });
});

describe('applyAspectRatio', () => {
  const bounds = { x: 0, y: 0, width: 1000, height: 1000 };

  it('shrinks width when the current rect is too wide for the target ratio', () => {
    const r = applyAspectRatio({ x: 100, y: 100, width: 800, height: 100 }, 1, 'tl', bounds);
    expect(r.width).toBeCloseTo(100);
    expect(r.height).toBeCloseTo(100);
    expect(r.x).toBeCloseTo(100);
    expect(r.y).toBeCloseTo(100);
  });

  it('shrinks height when the current rect is too tall', () => {
    const r = applyAspectRatio({ x: 100, y: 100, width: 100, height: 800 }, 1, 'tl', bounds);
    expect(r.width).toBeCloseTo(100);
    expect(r.height).toBeCloseTo(100);
  });

  it('keeps the top-left anchor when anchor=tl', () => {
    const r = applyAspectRatio({ x: 50, y: 50, width: 300, height: 300 }, 2, 'tl', bounds);
    expect(r.x).toBeCloseTo(50);
    expect(r.y).toBeCloseTo(50);
    expect(r.width / r.height).toBeCloseTo(2);
  });

  it('keeps the bottom-right anchor when anchor=br', () => {
    const r = applyAspectRatio({ x: 100, y: 100, width: 300, height: 300 }, 2, 'br', bounds);
    expect(r.x + r.width).toBeCloseTo(400);
    expect(r.y + r.height).toBeCloseTo(400);
  });

  it('keeps the rect inside bounds when reshaping pushes it past an edge', () => {
    const r = applyAspectRatio({ x: 950, y: 100, width: 50, height: 100 }, 2, 'tl', bounds);
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.x + r.width).toBeLessThanOrEqual(1000);
    expect(r.y + r.height).toBeLessThanOrEqual(1000);
  });

  it('returns the rect unchanged when it already matches the ratio', () => {
    const start = { x: 100, y: 100, width: 200, height: 100 };
    const r = applyAspectRatio(start, 2, 'tl', bounds);
    expect(r.width).toBeCloseTo(start.width);
    expect(r.height).toBeCloseTo(start.height);
  });

  it('seeds a fitted rect when input is degenerate', () => {
    const r = applyAspectRatio({ x: 50, y: 50, width: 0, height: 0 }, 2, 'center', bounds);
    expect(r.width / Math.max(r.height, 1)).toBeCloseTo(2);
    expect(r.width).toBeGreaterThan(0);
  });

  it('returns the rect unchanged for a non-positive ratio', () => {
    const start = { x: 100, y: 100, width: 200, height: 100 };
    expect(applyAspectRatio(start, 0, 'tl', bounds)).toEqual(start);
  });
});
