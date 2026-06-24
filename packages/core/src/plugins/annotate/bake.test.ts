import { describe, expect, it } from 'vitest';
import { paintShape } from './bake.js';
import { EMOJI_FONT_STACK } from './fonts.js';
import type { EmojiShape, TextShape } from './state.js';
import { TEXT_LINE_HEIGHT } from './text-layout.js';

/**
 * Minimal 2D-context stub: records fillText calls and measures each line at
 * 10px per character. Lets us assert the per-line offset math of paintText
 * without a real canvas (jsdom returns 0 from measureText).
 */
function stubCtx() {
  const calls: Array<{ text: string; x: number; y: number }> = [];
  const draws: Array<{ img: unknown; x: number; y: number; w: number; h: number }> = [];
  const ops: string[] = [];
  const ctx = {
    fillText: (text: string, x: number, y: number) => calls.push({ text, x, y }),
    drawImage: (img: unknown, x: number, y: number, w: number, h: number) =>
      draws.push({ img, x, y, w, h }),
    measureText: (text: string) => ({ width: text.length * 10 }),
    translate: (x: number, y: number) => ops.push(`translate(${x},${y})`),
    rotate: (a: number) => ops.push(`rotate(${a.toFixed(4)})`),
    save() {},
    restore() {},
    fillStyle: '',
    font: '',
    textAlign: '' as CanvasTextAlign,
    textBaseline: '' as CanvasTextBaseline,
  };
  return { ctx, calls, draws, ops };
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

describe('paintEmoji — single glyph at the box top-left, sized to the box edge', () => {
  const emoji: EmojiShape = {
    id: 'e',
    kind: 'emoji',
    x: 30,
    y: 40,
    emoji: '🚀',
    size: 96,
    rotation: 0,
  };

  it('draws the emoji at (x, y) with the box size as the font size', () => {
    const { ctx, calls } = stubCtx();
    paintShape(ctx as unknown as CanvasRenderingContext2D, emoji);
    expect(calls).toEqual([{ text: '🚀', x: 30, y: 40 }]);
  });

  it('sets a top-left, top-baseline font using the colour-emoji stack (fallback)', () => {
    const { ctx } = stubCtx();
    paintShape(ctx as unknown as CanvasRenderingContext2D, emoji);
    expect(ctx.textAlign).toBe('left');
    expect(ctx.textBaseline).toBe('top');
    expect(ctx.font).toBe(`96px ${EMOJI_FONT_STACK}`);
  });

  it('draws the resolved SVG artwork at the box, no font fallback', () => {
    const { ctx, calls, draws } = stubCtx();
    const artwork = { __fake: 'image' };
    paintShape(ctx as unknown as CanvasRenderingContext2D, emoji, {
      resolveEmojiImage: () => artwork as unknown as CanvasImageSource,
    });
    expect(draws).toEqual([{ img: artwork, x: 30, y: 40, w: 96, h: 96 }]);
    expect(calls).toEqual([]);
  });

  it('falls back to the font when the resolver returns null', () => {
    const { ctx, calls, draws } = stubCtx();
    paintShape(ctx as unknown as CanvasRenderingContext2D, emoji, {
      resolveEmojiImage: () => null,
    });
    expect(draws).toEqual([]);
    expect(calls).toEqual([{ text: '🚀', x: 30, y: 40 }]);
  });

  it('rotates about the box centre when rotation is non-zero', () => {
    const { ctx, ops } = stubCtx();
    const artwork = { __fake: 'image' };
    // size 96 at (30,40) → centre (78, 88); 90° = π/2.
    paintShape(
      ctx as unknown as CanvasRenderingContext2D,
      { ...emoji, rotation: 90 },
      {
        resolveEmojiImage: () => artwork as unknown as CanvasImageSource,
      },
    );
    expect(ops).toEqual([
      `translate(78,88)`,
      `rotate(${(Math.PI / 2).toFixed(4)})`,
      `translate(-78,-88)`,
    ]);
  });

  it('applies no rotation transform at 0°', () => {
    const { ctx, ops } = stubCtx();
    paintShape(ctx as unknown as CanvasRenderingContext2D, emoji, {
      resolveEmojiImage: () => ({}) as unknown as CanvasImageSource,
    });
    expect(ops).toEqual([]);
  });
});
