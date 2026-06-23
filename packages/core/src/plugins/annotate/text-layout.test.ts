import { describe, expect, it } from 'vitest';
import type { TextShape } from './state.js';
import {
  estimateLineWidth,
  layoutTextLines,
  lineOffset,
  TEXT_LINE_HEIGHT,
  textLines,
} from './text-layout.js';

// A deterministic measurer: each character is 10px wide.
const tenPerChar = (line: string): number => line.length * 10;

function makeText(overrides: Partial<TextShape> = {}): TextShape {
  return {
    id: 't',
    kind: 'text',
    x: 0,
    y: 0,
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

describe('textLines', () => {
  it('returns a single empty line for empty text', () => {
    expect(textLines('')).toEqual(['']);
  });

  it('splits on explicit newlines only (no wrapping)', () => {
    expect(textLines('a\nbb\nccc')).toEqual(['a', 'bb', 'ccc']);
  });

  it('preserves blank lines from consecutive newlines', () => {
    expect(textLines('a\n\nb')).toEqual(['a', '', 'b']);
  });
});

describe('layoutTextLines', () => {
  it('width is the widest measured line', () => {
    const layout = layoutTextLines(makeText({ text: 'a\nbbbb\ncc' }), tenPerChar);
    expect(layout.lines).toEqual(['a', 'bbbb', 'cc']);
    expect(layout.width).toBe(40); // widest line "bbbb" = 4 * 10
  });

  it('height is line count * fontSize * line-height', () => {
    const layout = layoutTextLines(makeText({ text: 'a\nb', fontSize: 20 }), tenPerChar);
    expect(layout.height).toBeCloseTo(2 * 20 * TEXT_LINE_HEIGHT);
  });

  it('keeps a minimum grabbable width for empty text', () => {
    const layout = layoutTextLines(makeText({ text: '', fontSize: 20 }), () => 0);
    expect(layout.width).toBeGreaterThan(0);
  });
});

describe('estimateLineWidth', () => {
  it('scales with character count and font size', () => {
    expect(estimateLineWidth('abcd', 20)).toBeCloseTo(4 * 20 * 0.55);
    expect(estimateLineWidth('', 20)).toBe(0);
  });
});

describe('lineOffset', () => {
  it('left-aligned lines start at the block origin', () => {
    expect(lineOffset(100, 40, 'left')).toBe(0);
    expect(lineOffset(100, 100, 'left')).toBe(0);
  });

  it('centres a line within the block', () => {
    expect(lineOffset(100, 40, 'center')).toBe(30);
  });

  it('right-aligns a line to the block edge', () => {
    expect(lineOffset(100, 40, 'right')).toBe(60);
  });

  it('is zero for a line as wide as the block, in every alignment', () => {
    expect(lineOffset(100, 100, 'center')).toBe(0);
    expect(lineOffset(100, 100, 'right')).toBe(0);
  });
});
