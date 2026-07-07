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
function stubCtx(metrics?: Record<string, number>) {
  const calls: Array<{ text: string; x: number; y: number }> = [];
  const draws: Array<{ img: unknown; x: number; y: number; w: number; h: number }> = [];
  const ops: string[] = [];
  const ctx = {
    fillText: (text: string, x: number, y: number) => calls.push({ text, x, y }),
    drawImage: (img: unknown, x: number, y: number, w: number, h: number) =>
      draws.push({ img, x, y, w, h }),
    // Emoji ink metrics (`actualBoundingBox*`) are absent in jsdom; a test can
    // pass them in to exercise the fit-and-centre path.
    measureText: (text: string) => ({ width: text.length * 10, ...metrics }),
    translate: (x: number, y: number) => ops.push(`translate(${x},${y})`),
    scale: (x: number, y: number) => ops.push(`scale(${x},${y})`),
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

/**
 * Narrow the test stub to the DOM context type. The stub implements only the
 * `CanvasRenderingContext2D` members `paintShape` touches (fillText, measureText,
 * translate / scale / rotate, save / restore, and the font/align fields), so the
 * cast is safe for these tests.
 */
function asCtx(ctx: ReturnType<typeof stubCtx>['ctx']): CanvasRenderingContext2D {
  return ctx as unknown as CanvasRenderingContext2D;
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
    paintShape(asCtx(ctx), makeText({ textAlign: 'left' }));
    expect(calls).toEqual([
      { text: 'a', x: 100, y: 50 },
      { text: 'bbbb', x: 100, y: 50 + lineHeight },
    ]);
  });

  it('center: each line is centred within the 40px block', () => {
    const { ctx, calls } = stubCtx();
    paintShape(asCtx(ctx), makeText({ textAlign: 'center' }));
    // 'a' width 10 → offset (40-10)/2 = 15; 'bbbb' width 40 → offset 0.
    expect(calls[0]).toEqual({ text: 'a', x: 115, y: 50 });
    expect(calls[1]).toEqual({ text: 'bbbb', x: 100, y: 50 + lineHeight });
  });

  it('right: each line is flush to the block right edge', () => {
    const { ctx, calls } = stubCtx();
    paintShape(asCtx(ctx), makeText({ textAlign: 'right' }));
    // 'a' width 10 → offset 40-10 = 30; 'bbbb' width 40 → offset 0.
    expect(calls[0]).toEqual({ text: 'a', x: 130, y: 50 });
    expect(calls[1]).toEqual({ text: 'bbbb', x: 100, y: 50 + lineHeight });
  });

  it('always uses left textAlign + top baseline (no align-dependent anchor)', () => {
    const { ctx } = stubCtx();
    paintShape(asCtx(ctx), makeText({ textAlign: 'right' }));
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
    paintShape(asCtx(ctx), emoji);
    expect(calls).toEqual([{ text: '🚀', x: 30, y: 40 }]);
  });

  it('sets a top-left, top-baseline font using the OS colour-emoji stack', () => {
    const { ctx } = stubCtx();
    paintShape(asCtx(ctx), emoji);
    expect(ctx.textAlign).toBe('left');
    expect(ctx.textBaseline).toBe('top');
    expect(ctx.font).toBe(`96px ${EMOJI_FONT_STACK}`);
  });

  it('rotates about the box centre when rotation is non-zero', () => {
    const { ctx, ops } = stubCtx();
    // size 96 at (30,40) → centre (78, 88); 90° = π/2.
    paintShape(asCtx(ctx), { ...emoji, rotation: 90 });
    expect(ops).toEqual([
      `translate(78,88)`,
      `rotate(${(Math.PI / 2).toFixed(4)})`,
      `translate(-78,-88)`,
    ]);
  });

  it('applies no rotation transform at 0°', () => {
    const { ctx, ops } = stubCtx();
    paintShape(asCtx(ctx), emoji);
    expect(ops).toEqual([]);
  });

  it('fits + centres the glyph in the box from measured ink bounds', () => {
    // ink 96 wide × 120 tall, offset within the em (left 10 / right 86,
    // ascent 100 / descent 20).
    const { ctx, calls, ops } = stubCtx({
      actualBoundingBoxLeft: 10,
      actualBoundingBoxRight: 86,
      actualBoundingBoxAscent: 100,
      actualBoundingBoxDescent: 20,
    });
    paintShape(asCtx(ctx), emoji);
    // box (30,40) size 96 → centre (78,88); fit scale = min(96/96, 96/120) = 0.8.
    expect(ops).toEqual(['translate(78,88)', 'scale(0.8,0.8)']);
    // ink centred at the origin: x = (10-86)/2 = -38, y = (100-20)/2 = 40.
    expect(calls).toEqual([{ text: '🚀', x: -38, y: 40 }]);
    expect(ctx.textBaseline).toBe('alphabetic');
  });
});
