import { describe, expect, it } from 'vitest';
import { type HandleDirection, resizeRectFromHandle } from './resize.js';

const bounds = { x: 0, y: 0, width: 1000, height: 1000 };
const startRect = { x: 200, y: 200, width: 400, height: 400 };

describe('resizeRectFromHandle — corner handles, free aspect', () => {
  it('br moves the bottom-right corner, anchoring top-left', () => {
    const r = resizeRectFromHandle(startRect, 'br', { x: 700, y: 800 }, { bounds });
    expect(r).toEqual({ x: 200, y: 200, width: 500, height: 600 });
  });

  it('tl moves the top-left corner, anchoring bottom-right', () => {
    const r = resizeRectFromHandle(startRect, 'tl', { x: 100, y: 50 }, { bounds });
    expect(r).toEqual({ x: 100, y: 50, width: 500, height: 550 });
  });

  it('tr anchors the bottom-left corner', () => {
    const r = resizeRectFromHandle(startRect, 'tr', { x: 800, y: 100 }, { bounds });
    expect(r).toEqual({ x: 200, y: 100, width: 600, height: 500 });
  });

  it('bl anchors the top-right corner', () => {
    const r = resizeRectFromHandle(startRect, 'bl', { x: 50, y: 800 }, { bounds });
    expect(r).toEqual({ x: 50, y: 200, width: 550, height: 600 });
  });
});

describe('resizeRectFromHandle — edge handles', () => {
  it('r moves only the right edge', () => {
    const r = resizeRectFromHandle(startRect, 'r', { x: 800, y: 999 }, { bounds });
    expect(r).toEqual({ x: 200, y: 200, width: 600, height: 400 });
  });

  it('l moves only the left edge', () => {
    const r = resizeRectFromHandle(startRect, 'l', { x: 50, y: 999 }, { bounds });
    expect(r).toEqual({ x: 50, y: 200, width: 550, height: 400 });
  });

  it('t moves only the top edge', () => {
    const r = resizeRectFromHandle(startRect, 't', { x: 999, y: 100 }, { bounds });
    expect(r).toEqual({ x: 200, y: 100, width: 400, height: 500 });
  });

  it('b moves only the bottom edge', () => {
    const r = resizeRectFromHandle(startRect, 'b', { x: 999, y: 800 }, { bounds });
    expect(r).toEqual({ x: 200, y: 200, width: 400, height: 600 });
  });
});

describe('resizeRectFromHandle — clamping and minimums', () => {
  it('clamps the rect inside the bounds when the pointer escapes', () => {
    const r = resizeRectFromHandle(startRect, 'br', { x: 1500, y: 1500 }, { bounds });
    expect(r.x + r.width).toBeLessThanOrEqual(1000);
    expect(r.y + r.height).toBeLessThanOrEqual(1000);
  });

  it('does not let the rect go below minSize on a corner handle', () => {
    const r = resizeRectFromHandle(startRect, 'br', { x: 200, y: 200 }, { bounds, minSize: 5 });
    expect(r.width).toBeGreaterThanOrEqual(5);
    expect(r.height).toBeGreaterThanOrEqual(5);
  });

  it('does not let the rect go below minSize on an edge handle', () => {
    const r = resizeRectFromHandle(startRect, 'r', { x: 199, y: 0 }, { bounds, minSize: 10 });
    expect(r.width).toBeGreaterThanOrEqual(10);
  });
});

describe('resizeRectFromHandle — drag-through-anchor (sign flip)', () => {
  it('br dragged past the anchor flips the rect normalised', () => {
    const r = resizeRectFromHandle(startRect, 'br', { x: 100, y: 100 }, { bounds, minSize: 1 });
    expect(r.x).toBeLessThanOrEqual(200);
    expect(r.y).toBeLessThanOrEqual(200);
    expect(r.width).toBeGreaterThan(0);
    expect(r.height).toBeGreaterThan(0);
  });
});

describe('resizeRectFromHandle — aspect-ratio constraint', () => {
  it('enforces 1:1 when dragging br', () => {
    const r = resizeRectFromHandle(startRect, 'br', { x: 800, y: 500 }, { bounds, aspectRatio: 1 });
    expect(r.width / r.height).toBeCloseTo(1);
    expect(r.x).toBeCloseTo(200);
    expect(r.y).toBeCloseTo(200);
  });

  it('enforces 16:9 when dragging br', () => {
    const r = resizeRectFromHandle(
      startRect,
      'br',
      { x: 900, y: 700 },
      { bounds, aspectRatio: 16 / 9 },
    );
    expect(r.width / r.height).toBeCloseTo(16 / 9);
  });

  it('keeps the result inside bounds even when ratio + clamp interact', () => {
    const r = resizeRectFromHandle(
      { x: 50, y: 50, width: 100, height: 100 },
      'tl',
      { x: -200, y: -200 },
      { bounds, aspectRatio: 16 / 9 },
    );
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.x + r.width).toBeLessThanOrEqual(1000);
    expect(r.y + r.height).toBeLessThanOrEqual(1000);
  });
});

describe('resizeRectFromHandle — exhaustive handle coverage', () => {
  const handles: readonly HandleDirection[] = ['tl', 't', 'tr', 'r', 'br', 'b', 'bl', 'l'];
  it.each(handles)('returns a rect inside bounds for handle=%s', (h) => {
    const r = resizeRectFromHandle(startRect, h, { x: 1500, y: 1500 }, { bounds });
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.x + r.width).toBeLessThanOrEqual(1000.0001);
    expect(r.y + r.height).toBeLessThanOrEqual(1000.0001);
  });
});
