import { describe, expect, it } from 'vitest';
import {
  ALL_SELECTION_HANDLES,
  boundingBoxOf,
  rectFromHandleDrag,
  selectionHandlePositions,
} from './geometry.js';
import type { ArrowShape, FreehandShape, RectShape, TextShape } from './state.js';
import { TEXT_LINE_HEIGHT } from './text-layout.js';

function makeText(overrides: Partial<TextShape>): TextShape {
  return {
    id: 't',
    kind: 'text',
    x: 100,
    y: 50,
    text: '',
    fontSize: 20,
    color: '#000',
    textAlign: 'left',
    fontFamily: 'system',
    fontWeight: 'normal',
    fontStyle: 'normal',
    ...overrides,
  };
}

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

  it('measures the natural text extent and a single-line height for short text', () => {
    const text = makeText({ x: 100, y: 50, text: 'short', fontSize: 20, textAlign: 'left' });
    const box = boundingBoxOf(text);
    // Left-aligned: box left edge is the anchor.
    expect(box.x).toBe(100);
    expect(box.y).toBe(50);
    expect(box.width).toBeGreaterThan(0);
    // One line: fontSize * line-height.
    expect(box.height).toBeCloseTo(20 * TEXT_LINE_HEIGHT);
  });

  it('keeps the same top-left origin for every alignment', () => {
    const left = boundingBoxOf(makeText({ x: 100, y: 50, text: 'hello', textAlign: 'left' }));
    const centre = boundingBoxOf(makeText({ x: 100, y: 50, text: 'hello', textAlign: 'center' }));
    const right = boundingBoxOf(makeText({ x: 100, y: 50, text: 'hello', textAlign: 'right' }));
    // shape.x is the block's top-left for all aligns; alignment justifies lines
    // *within* the block, it does not move the origin.
    expect(left.x).toBe(100);
    expect(centre.x).toBe(100);
    expect(right.x).toBe(100);
    expect(centre.width).toBe(left.width);
    expect(right.width).toBe(left.width);
  });

  it('grows height with explicit line breaks', () => {
    const oneLine = boundingBoxOf(makeText({ text: 'a' }));
    const twoLines = boundingBoxOf(makeText({ text: 'a\nb' }));
    expect(twoLines.height).toBeCloseTo(oneLine.height * 2);
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
