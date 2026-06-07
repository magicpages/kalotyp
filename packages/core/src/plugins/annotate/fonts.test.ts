import { describe, expect, it } from 'vitest';
import { cssFontString, fontStackFor, SYSTEM_FONT_STACK, TEXT_FONTS } from './fonts.js';
import type { TextShape } from './state.js';

function makeText(overrides: Partial<TextShape> = {}): TextShape {
  return {
    id: 't',
    kind: 'text',
    x: 0,
    y: 0,
    text: 'hi',
    fontSize: 32,
    color: '#000',
    textAlign: 'left',
    fontFamily: 'system',
    fontWeight: 'normal',
    fontStyle: 'normal',
    ...overrides,
  };
}

describe('fontStackFor', () => {
  it('resolves the system key to the system stack', () => {
    expect(fontStackFor('system')).toBe(SYSTEM_FONT_STACK);
  });

  it('resolves a known key to its stack', () => {
    expect(fontStackFor('inter')).toContain('Inter');
  });

  it('falls back to the system stack for an unknown key', () => {
    expect(fontStackFor('does-not-exist')).toBe(SYSTEM_FONT_STACK);
  });
});

describe('cssFontString', () => {
  it('builds a plain size + stack for regular system text', () => {
    expect(cssFontString(makeText())).toBe(`32px ${SYSTEM_FONT_STACK}`);
  });

  it('includes weight and style for bold italic', () => {
    const s = cssFontString(
      makeText({ fontFamily: 'inter', fontWeight: 'bold', fontStyle: 'italic' }),
    );
    expect(s).toBe('italic bold 32px "Inter", sans-serif');
  });

  it('scales the size for the zoomed editor', () => {
    expect(cssFontString(makeText({ fontSize: 20 }), 2)).toBe(`40px ${SYSTEM_FONT_STACK}`);
  });
});

describe('TEXT_FONTS catalogue', () => {
  it('starts with the system default and has unique keys', () => {
    expect(TEXT_FONTS[0]?.key).toBe('system');
    expect(TEXT_FONTS[0]?.bunnyName).toBeNull();
    const keys = TEXT_FONTS.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('gives every non-system font a Bunny slug for loading', () => {
    for (const font of TEXT_FONTS.slice(1)) {
      expect(font.bunnyName).toBeTruthy();
    }
  });
});
