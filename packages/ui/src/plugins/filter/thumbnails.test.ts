import { describe, expect, it } from 'vitest';
import { computeThumbnailDims } from './thumbnails.js';

describe('computeThumbnailDims', () => {
  it('returns max dims for an exact 4:3 source', () => {
    const dims = computeThumbnailDims({ width: 4000, height: 3000 });
    expect(dims).toEqual({ width: 80, height: 60 });
  });

  it('letterboxes a portrait source into a tall, narrow thumbnail', () => {
    const dims = computeThumbnailDims({ width: 1000, height: 2000 });
    expect(dims.height).toBe(60);
    expect(dims.width).toBe(30);
  });

  it('letterboxes an ultra-wide source into a wide, short thumbnail', () => {
    const dims = computeThumbnailDims({ width: 4000, height: 1000 });
    expect(dims.width).toBe(80);
    expect(dims.height).toBe(20);
  });

  it('handles a square source by capping the shorter axis', () => {
    const dims = computeThumbnailDims({ width: 1000, height: 1000 });
    expect(dims.width).toBe(60);
    expect(dims.height).toBe(60);
  });

  it('falls back to max dims for a degenerate (zero-size) source', () => {
    expect(computeThumbnailDims({ width: 0, height: 0 })).toEqual({ width: 80, height: 60 });
    expect(computeThumbnailDims({ width: 0, height: 100 })).toEqual({ width: 80, height: 60 });
  });

  it('never returns dimensions smaller than 1', () => {
    const dims = computeThumbnailDims({ width: 1_000_000, height: 1 });
    expect(dims.width).toBeGreaterThanOrEqual(1);
    expect(dims.height).toBeGreaterThanOrEqual(1);
  });
});
