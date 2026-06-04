import { describe, expect, it } from 'vitest';
import { hitTest, pickShape } from './hit-test.js';
import type {
  ArrowShape,
  EllipseShape,
  FreehandShape,
  HighlightShape,
  RectShape,
  Shape,
  TextShape,
} from './state.js';

const filledRect: RectShape = {
  id: 'r1',
  kind: 'rect',
  x: 100,
  y: 100,
  width: 80,
  height: 60,
  strokeColor: '#000',
  strokeWidth: 2,
  fillColor: '#ff0',
};

const outlineRect: RectShape = {
  id: 'r2',
  kind: 'rect',
  x: 100,
  y: 100,
  width: 80,
  height: 60,
  strokeColor: '#000',
  strokeWidth: 2,
  fillColor: null,
};

describe('hitTest — rect', () => {
  it('filled rect is picked anywhere inside', () => {
    expect(hitTest(filledRect, { x: 140, y: 130 })).toBe(true);
  });

  it('filled rect is rejected outside its bounds', () => {
    expect(hitTest(filledRect, { x: 50, y: 50 })).toBe(false);
  });

  it('outlined rect is picked on the stroke (with tolerance)', () => {
    expect(hitTest(outlineRect, { x: 100, y: 130 })).toBe(true);
    expect(hitTest(outlineRect, { x: 140, y: 100 })).toBe(true);
  });

  it('outlined rect is NOT picked in its hollow centre', () => {
    expect(hitTest(outlineRect, { x: 140, y: 130 })).toBe(false);
  });
});

describe('hitTest — ellipse', () => {
  const ellipse: EllipseShape = {
    id: 'e1',
    kind: 'ellipse',
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    strokeColor: '#000',
    strokeWidth: 2,
    fillColor: '#0f0',
  };

  it('picks the centre of a filled ellipse', () => {
    expect(hitTest(ellipse, { x: 100, y: 50 })).toBe(true);
  });

  it('rejects the corner of the bounding box (outside the ellipse)', () => {
    expect(hitTest(ellipse, { x: 5, y: 5 })).toBe(false);
  });

  it('outline ellipse is picked on the curve', () => {
    const outline: EllipseShape = { ...ellipse, fillColor: null };
    expect(hitTest(outline, { x: 100, y: 0 })).toBe(true);
    expect(hitTest(outline, { x: 100, y: 50 })).toBe(false);
  });
});

describe('hitTest — arrow', () => {
  const arrow: ArrowShape = {
    id: 'a1',
    kind: 'arrow',
    x1: 0,
    y1: 0,
    x2: 100,
    y2: 0,
    color: '#000',
    strokeWidth: 4,
  };

  it('picks a point on the line', () => {
    expect(hitTest(arrow, { x: 50, y: 0 })).toBe(true);
    expect(hitTest(arrow, { x: 50, y: 2 })).toBe(true);
  });

  it('rejects far from the line', () => {
    expect(hitTest(arrow, { x: 50, y: 50 })).toBe(false);
  });

  it('rejects beyond the segment endpoints', () => {
    expect(hitTest(arrow, { x: 200, y: 0 })).toBe(false);
  });
});

describe('hitTest — freehand', () => {
  const free: FreehandShape = {
    id: 'f1',
    kind: 'freehand',
    points: [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 50 },
      { x: 100, y: 50 },
    ],
    color: '#000',
    strokeWidth: 6,
  };

  it('picks a point on a segment of the path', () => {
    expect(hitTest(free, { x: 25, y: 0 })).toBe(true);
  });

  it('rejects a point inside the bounding box but off the path', () => {
    expect(hitTest(free, { x: 25, y: 30 })).toBe(false);
  });

  it('rejects a point outside the bounding box (fast path)', () => {
    expect(hitTest(free, { x: 1000, y: 1000 })).toBe(false);
  });

  it('handles a single-point path as a dot', () => {
    const dot: FreehandShape = { ...free, points: [{ x: 50, y: 50 }] };
    expect(hitTest(dot, { x: 50, y: 50 })).toBe(true);
    expect(hitTest(dot, { x: 200, y: 200 })).toBe(false);
  });
});

describe('hitTest — highlight', () => {
  const highlight: HighlightShape = {
    id: 'h1',
    kind: 'highlight',
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ],
    color: 'rgba(255,235,59,0.35)',
    strokeWidth: 18,
  };
  it('picks anywhere along the wide highlight stroke', () => {
    expect(hitTest(highlight, { x: 50, y: 5 })).toBe(true);
  });
});

describe('hitTest — text', () => {
  const text: TextShape = {
    id: 't1',
    kind: 'text',
    x: 100,
    y: 100,
    text: 'hello',
    fontSize: 32,
    color: '#000',
    textAlign: 'left',
  };
  it('picks within the bounding box estimate', () => {
    expect(hitTest(text, { x: 130, y: 110 })).toBe(true);
  });
  it('rejects outside the box', () => {
    expect(hitTest(text, { x: 0, y: 0 })).toBe(false);
  });
});

describe('pickShape', () => {
  it('returns the topmost (last drawn) shape under the point', () => {
    const a: Shape = { ...filledRect, id: 'a' };
    const b: Shape = { ...filledRect, id: 'b', x: 120 };
    const picked = pickShape([a, b], { x: 140, y: 130 });
    expect(picked?.id).toBe('b');
  });

  it('returns undefined when no shape contains the point', () => {
    expect(pickShape([filledRect], { x: 0, y: 0 })).toBeUndefined();
  });
});
