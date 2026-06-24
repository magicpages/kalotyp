import { afterEach, describe, expect, it } from 'vitest';
import {
  emojiKeyFor,
  emojiSvgUrl,
  emojiSvgUrlForKey,
  onEmojiImageLoad,
  resolveEmojiImage,
  setEmojiAssetBase,
} from './emoji-images.js';

afterEach(() => {
  // Reset any base override / global between tests.
  setEmojiAssetBase('/emoji/');
  (window as { __KALOTYP_EMOJI_BASE__?: unknown }).__KALOTYP_EMOJI_BASE__ = undefined;
});

describe('emoji-images — key + URL mapping', () => {
  it('maps a known emoji to its OpenMoji artwork key', () => {
    expect(emojiKeyFor('😀')).toBe('1F600');
    expect(emojiKeyFor('🚀')).toBe('1F680');
  });

  it('returns undefined / null for an unknown character', () => {
    expect(emojiKeyFor('a')).toBeUndefined();
    expect(emojiSvgUrl('a')).toBeNull();
  });

  it('builds the same-origin SVG URL from a key', () => {
    setEmojiAssetBase('/emoji/');
    expect(emojiSvgUrlForKey('1F600')).toBe('/emoji/1F600.svg');
    expect(emojiSvgUrl('🚀')).toBe('/emoji/1F680.svg');
  });

  it('honours an explicit asset-base override (trailing slash enforced)', () => {
    setEmojiAssetBase('https://cdn.example/x');
    expect(emojiSvgUrlForKey('1F600')).toBe('https://cdn.example/x/1F600.svg');
  });
});

describe('emoji-images — resolver', () => {
  it('returns null until the image has loaded (and is safe to call repeatedly)', () => {
    // jsdom does not fetch the <img>, so the cached entry never flips to loaded
    // here; the resolver therefore returns null and the caller uses the font
    // fallback. The real load path is covered by the Playwright check.
    expect(resolveEmojiImage('😀')).toBeNull();
    expect(resolveEmojiImage('😀')).toBeNull();
  });

  it('returns null for an unknown character without creating work', () => {
    expect(resolveEmojiImage('a')).toBeNull();
  });

  it('registers and unregisters load listeners', () => {
    let calls = 0;
    const off = onEmojiImageLoad(() => {
      calls += 1;
    });
    expect(typeof off).toBe('function');
    off();
    expect(calls).toBe(0);
  });
});
