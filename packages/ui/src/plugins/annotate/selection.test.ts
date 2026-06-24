import {
  EMOJI_MIN_SIZE,
  type EmojiShape,
  type RectShape,
  type TextShape,
} from '@magicpages/kalotyp-core';
import { describe, expect, it } from 'vitest';
import { applyHandleDrag, emojiRotationFromPointer } from './selection.js';

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

describe('applyHandleDrag — emoji resizes uniformly from the corners', () => {
  const emoji: EmojiShape = {
    id: 'e',
    kind: 'emoji',
    x: 100,
    y: 100,
    emoji: '😀',
    size: 80,
    rotation: 0,
  };

  it('drags br: top-left stays anchored, size = larger axis delta', () => {
    const next = applyHandleDrag(emoji, 'br', { x: 240, y: 220 }) as EmojiShape;
    // dx = 140, dy = 120 → size 140; anchor (100,100) unchanged.
    expect(next).toMatchObject({ x: 100, y: 100, size: 140 });
  });

  it('drags tl: bottom-right stays anchored, the box re-derives x/y', () => {
    const next = applyHandleDrag(emoji, 'tl', { x: 110, y: 130 }) as EmojiShape;
    // right=180, bottom=180; dx=70, dy=50 → size 70; x=180-70, y=180-70.
    expect(next).toMatchObject({ x: 110, y: 110, size: 70 });
  });

  it('floors at EMOJI_MIN_SIZE so the sticker never collapses', () => {
    const next = applyHandleDrag(emoji, 'br', { x: 101, y: 101 }) as EmojiShape;
    expect(next.size).toBe(EMOJI_MIN_SIZE);
    expect(next).toMatchObject({ x: 100, y: 100 });
  });

  it('ignores edge handles (only corners are shown for emoji)', () => {
    for (const dir of ['l', 'r', 't', 'b'] as const) {
      expect(applyHandleDrag(emoji, dir, { x: 300, y: 300 })).toBe(emoji);
    }
  });
});

describe('emojiRotationFromPointer', () => {
  const center = { x: 100, y: 100 };

  it('is 0° when the pointer is directly above the centre', () => {
    expect(emojiRotationFromPointer(center, { x: 100, y: 20 })).toBe(0);
  });

  it('is 90° to the right, 180° below, 270° to the left', () => {
    expect(emojiRotationFromPointer(center, { x: 180, y: 100 })).toBe(90);
    expect(emojiRotationFromPointer(center, { x: 100, y: 180 })).toBe(180);
    expect(emojiRotationFromPointer(center, { x: 20, y: 100 })).toBe(270);
  });
});
