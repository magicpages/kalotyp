import { describe, expect, it } from 'vitest';
import {
  ALL_SELECTION_HANDLES,
  alignToOrigin,
  boundingBoxOf,
  estimateTextSize,
  rectFromHandleDrag,
  selectionHandlePositions,
} from './geometry.js';
import type { ArrowShape, FreehandShape, RectShape, TextShape } from './state.js';

describe('boundingBoxOf', () => {
  it('returns the rect for a rect shape', () => {
    const rect: RectShape = {
      id: 'r',
      kind: 'rect',
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      strokeColor: '#000',
      strokeWidth: 2,
      fillColor: null,
    };
    expect(boundingBoxOf(rect)).toEqual({ x: 10, y: 20, width: 100, height: 50 });
  });

  it('encloses both endpoints of an arrow', () => {
    const arrow: ArrowShape = {
      id: 'a',
      kind: 'arrow',
      x1: 100,
      y1: 50,
      x2: 20,
      y2: 200,
      color: '#000',
      strokeWidth: 4,
    };
    const box = boundingBoxOf(arrow);
    expect(box.x).toBe(20);
    expect(box.y).toBe(50);
    expect(box.width).toBe(80);
    expect(box.height).toBe(150);
  });

  it('encloses every point of a freehand path', () => {
    const free: FreehandShape = {
      id: 'f',
      kind: 'freehand',
      points: [
        { x: 0, y: 100 },
        { x: 50, y: 0 },
        { x: 100, y: 75 },
      ],
      color: '#000',
      strokeWidth: 3,
    };
    expect(boundingBoxOf(free)).toEqual({ x: 0, y: 0, width: 100, height: 100 });
  });

  it('returns a degenerate rect for an empty freehand path', () => {
    expect(
      boundingBoxOf({
        id: 'f',
        kind: 'freehand',
        points: [],
        color: '#000',
        strokeWidth: 1,
      } as FreehandShape),
    ).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it('aligns text bounding box to the textAlign origin', () => {
    const text: TextShape = {
      id: 't',
      kind: 'text',
      x: 100,
      y: 50,
      text: 'centred',
      fontSize: 20,
      color: '#000',
      textAlign: 'center',
    };
    const box = boundingBoxOf(text);
    const { width } = estimateTextSize('centred', 20);
    expect(box.x).toBeCloseTo(100 - width / 2);
    expect(box.y).toBe(50);
  });
});

describe('selectionHandlePositions', () => {
  it('exposes corner + edge handles in image-space pixels', () => {
    const positions = selectionHandlePositions({ x: 10, y: 20, width: 100, height: 50 });
    expect(positions.tl).toEqual({ x: 10, y: 20 });
    expect(positions.br).toEqual({ x: 110, y: 70 });
    expect(positions.t).toEqual({ x: 60, y: 20 });
    expect(positions.l).toEqual({ x: 10, y: 45 });
  });

  it('exposes the eight expected handles', () => {
    const positions = selectionHandlePositions({ x: 0, y: 0, width: 1, height: 1 });
    for (const handle of ALL_SELECTION_HANDLES) {
      expect(positions[handle]).toBeDefined();
    }
  });
});

describe('rectFromHandleDrag', () => {
  const initial = { x: 100, y: 100, width: 100, height: 50 };

  it('drags br to expand both axes', () => {
    expect(rectFromHandleDrag(initial, 'br', { x: 250, y: 200 })).toEqual({
      x: 100,
      y: 100,
      width: 150,
      height: 100,
    });
  });

  it('drags tl to shrink the rect from its top-left', () => {
    expect(rectFromHandleDrag(initial, 'tl', { x: 120, y: 110 })).toEqual({
      x: 120,
      y: 110,
      width: 80,
      height: 40,
    });
  });

  it('drags edge handles on a single axis', () => {
    expect(rectFromHandleDrag(initial, 'r', { x: 250, y: 0 })).toEqual({
      x: 100,
      y: 100,
      width: 150,
      height: 50,
    });
    expect(rectFromHandleDrag(initial, 't', { x: 0, y: 60 })).toEqual({
      x: 100,
      y: 60,
      width: 100,
      height: 90,
    });
  });

  it('produces a negative-width rect when the user drags past the opposite edge', () => {
    const out = rectFromHandleDrag(initial, 'br', { x: 50, y: 200 });
    expect(out.width).toBe(-50);
    expect(out.height).toBe(100);
  });
});

describe('alignToOrigin', () => {
  it('returns the anchor for left-align', () => {
    expect(alignToOrigin(100, 80, 'left')).toBe(100);
  });
  it('shifts left by half the width for centre', () => {
    expect(alignToOrigin(100, 80, 'center')).toBe(60);
  });
  it('shifts left by the full width for right', () => {
    expect(alignToOrigin(100, 80, 'right')).toBe(20);
  });
});
