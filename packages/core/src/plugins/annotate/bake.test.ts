import { describe, expect, it } from 'vitest';
import { paintShape } from './bake.js';
import type { TextShape } from './state.js';
import { TEXT_LINE_HEIGHT } from './text-layout.js';

/**
 * Minimal 2D-context stub: records fillText calls and measures each line at
 * 10px per character. Lets us assert the per-line offset math of paintText
 * without a real canvas (jsdom returns 0 from measureText).
 */
function stubCtx() {
  const calls: Array<{ text: string; x: number; y: number }> = [];
  const ctx = {
    fillText: (text: string, x: number, y: number) => calls.push({ text, x, y }),
    measureText: (text: string) => ({ width: text.length * 10 }),
    save() {},
    restore() {},
    fillStyle: '',
    font: '',
    textAlign: '' as CanvasTextAlign,
    textBaseline: '' as CanvasTextBaseline,
  };
  return { ctx, calls };
}

function makeText(overrides: Partial<TextShape>): TextShape {
  return {
    id: 't',
    kind: 'text',
    x: 100,
    y: 50,
    text: 'a\nbbbb', // widths: 10, 40 → block width 40
    fontSize: 20,
    color: '#000',
    textAlign: 'left',
    fontFamily: 'system',
    fontWeight: 'normal',
    fontStyle: 'normal',
    ...overrides,
  };
}

describe('paintText — per-line alignment offsets from a fixed top-left origin', () => {
  const lineHeight = 20 * TEXT_LINE_HEIGHT;

  it('left: both lines start at shape.x; y steps by line height', () => {
    const { ctx, calls } = stubCtx();
    paintShape(ctx as unknown as CanvasRenderingContext2D, makeText({ textAlign: 'left' }));
    expect(calls).toEqual([
      { text: 'a', x: 100, y: 50 },
      { text: 'bbbb', x: 100, y: 50 + lineHeight },
    ]);
  });

  it('center: each line is centred within the 40px block', () => {
    const { ctx, calls } = stubCtx();
    paintShape(ctx as unknown as CanvasRenderingContext2D, makeText({ textAlign: 'center' }));
    // 'a' width 10 → offset (40-10)/2 = 15; 'bbbb' width 40 → offset 0.
    expect(calls[0]).toEqual({ text: 'a', x: 115, y: 50 });
    expect(calls[1]).toEqual({ text: 'bbbb', x: 100, y: 50 + lineHeight });
  });

  it('right: each line is flush to the block right edge', () => {
    const { ctx, calls } = stubCtx();
    paintShape(ctx as unknown as CanvasRenderingContext2D, makeText({ textAlign: 'right' }));
    // 'a' width 10 → offset 40-10 = 30; 'bbbb' width 40 → offset 0.
    expect(calls[0]).toEqual({ text: 'a', x: 130, y: 50 });
    expect(calls[1]).toEqual({ text: 'bbbb', x: 100, y: 50 + lineHeight });
  });

  it('always uses left textAlign + top baseline (no align-dependent anchor)', () => {
    const { ctx } = stubCtx();
    paintShape(ctx as unknown as CanvasRenderingContext2D, makeText({ textAlign: 'right' }));
    expect(ctx.textAlign).toBe('left');
    expect(ctx.textBaseline).toBe('top');
  });
});
