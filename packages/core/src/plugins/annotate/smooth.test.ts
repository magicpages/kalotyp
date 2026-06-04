import { describe, expect, it, vi } from 'vitest';
import { MIN_SAMPLE_DISTANCE, decimatePoints, tracePath } from './smooth.js';

describe('decimatePoints', () => {
  it('passes through empty input unchanged', () => {
    expect(decimatePoints([])).toEqual([]);
  });

  it('passes through a single point unchanged', () => {
    expect(decimatePoints([{ x: 1, y: 2 }])).toEqual([{ x: 1, y: 2 }]);
  });

  it('drops points within MIN_SAMPLE_DISTANCE of the previous kept point', () => {
    const noise = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1.5, y: 0 },
      { x: 5, y: 0 },
    ];
    const out = decimatePoints(noise);
    expect(out[0]).toEqual({ x: 0, y: 0 });
    expect(out).toHaveLength(2);
    expect(out[out.length - 1]).toEqual({ x: 5, y: 0 });
  });

  it('always keeps the first and last sample', () => {
    const ten = Array.from({ length: 10 }, (_, i) => ({ x: i * 0.5, y: 0 }));
    const out = decimatePoints(ten);
    expect(out[0]).toEqual(ten[0]);
    expect(out[out.length - 1]).toEqual(ten[ten.length - 1]);
  });

  it('threshold is exactly MIN_SAMPLE_DISTANCE', () => {
    const exactly = [
      { x: 0, y: 0 },
      { x: MIN_SAMPLE_DISTANCE, y: 0 },
      { x: MIN_SAMPLE_DISTANCE * 2, y: 0 },
    ];
    const out = decimatePoints(exactly);
    expect(out.length).toBe(3);
  });
});

describe('tracePath', () => {
  function makeStubCtx(): {
    ctx: {
      moveTo: ReturnType<typeof vi.fn>;
      lineTo: ReturnType<typeof vi.fn>;
      quadraticCurveTo: ReturnType<typeof vi.fn>;
    };
  } {
    return {
      ctx: {
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        quadraticCurveTo: vi.fn(),
      },
    };
  }

  it('does nothing for an empty path', () => {
    const { ctx } = makeStubCtx();
    tracePath(ctx as unknown as CanvasRenderingContext2D, []);
    expect(ctx.moveTo).not.toHaveBeenCalled();
  });

  it('plants a tiny dot for a single-point path', () => {
    const { ctx } = makeStubCtx();
    tracePath(ctx as unknown as CanvasRenderingContext2D, [{ x: 5, y: 5 }]);
    expect(ctx.moveTo).toHaveBeenCalledWith(5, 5);
    expect(ctx.lineTo).toHaveBeenCalledWith(5, 5);
  });

  it('uses moveTo + quadraticCurveTo for a multi-point path', () => {
    const { ctx } = makeStubCtx();
    tracePath(ctx as unknown as CanvasRenderingContext2D, [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 10 },
      { x: 30, y: 0 },
    ]);
    expect(ctx.moveTo).toHaveBeenCalledWith(0, 0);
    expect(ctx.quadraticCurveTo).toHaveBeenCalledWith(10, 0, 15, 5);
    expect(ctx.quadraticCurveTo).toHaveBeenCalledWith(20, 10, 25, 5);
    expect(ctx.lineTo).toHaveBeenCalledWith(30, 0);
  });
});
