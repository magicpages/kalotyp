import type { RectShape, TextShape } from '@magicpages/kalotyp-core';
import { describe, expect, it } from 'vitest';
import { applyHandleDrag } from './selection.js';

function makeText(overrides: Partial<TextShape> = {}): TextShape {
  return {
    id: 't',
    kind: 'text',
    x: 100,
    y: 100,
    text: 'hello world',
    fontSize: 20,
    color: '#000',
    textAlign: 'left',
    fontFamily: 'system',
    fontWeight: 'normal',
    fontStyle: 'normal',
    ...overrides,
  };
}

describe('applyHandleDrag — text is not handle-resizable', () => {
  it('leaves a text shape unchanged for every handle (size is panel-driven)', () => {
    const text = makeText();
    for (const dir of ['l', 'r', 't', 'b', 'tl', 'tr', 'bl', 'br'] as const) {
      expect(applyHandleDrag(text, dir, { x: 500, y: 400 })).toBe(text);
    }
  });
});

describe('applyHandleDrag — rect still resizes', () => {
  const rect: RectShape = {
    id: 'r',
    kind: 'rect',
    x: 100,
    y: 100,
    width: 100,
    height: 50,
    strokeColor: '#000',
    strokeWidth: 2,
    fillColor: null,
  };

  it('drags the right edge to widen the rect', () => {
    const next = applyHandleDrag(rect, 'r', { x: 260, y: 0 }) as RectShape;
    expect(next.width).toBe(160);
    expect(next.x).toBe(100);
  });
});
