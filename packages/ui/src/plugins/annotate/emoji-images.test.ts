import { afterEach, describe, expect, it, vi } from 'vitest';
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

describe('emoji-images — default base derived from the bundle URL', () => {
  it('falls back, uses the derived default, then lets an explicit base win', async () => {
    // Fresh module instance so we start from pristine state (no override set by
    // a prior test's afterEach, which would otherwise mask the lower tiers).
    vi.resetModules();
    const mod = await import('./emoji-images.js');

    // No override, no global, no derived default → last-resort same-origin path.
    expect(mod.emojiSvgUrlForKey('1F600')).toBe('/emoji/1F600.svg');

    // The Ghost entry sets this from `import.meta.url`; a trailing slash is
    // enforced and the emoji now load from that (bundle) origin.
    mod.setEmojiAssetBaseDefault('https://accounts.example/kalotyp/emoji');
    expect(mod.emojiSvgUrlForKey('1F600')).toBe('https://accounts.example/kalotyp/emoji/1F600.svg');

    // A self-hoster's explicit choice always wins over the derived default.
    mod.setEmojiAssetBase('https://self.example/e/');
    expect(mod.emojiSvgUrlForKey('1F600')).toBe('https://self.example/e/1F600.svg');
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

  it('fires load listeners on a base change and stops after unsubscribe', () => {
    let calls = 0;
    const off = onEmojiImageLoad(() => {
      calls += 1;
    });
    // A base change invalidates the cache and notifies listeners (so a repaint
    // reloads the artwork from the new base).
    setEmojiAssetBase('/cover-a/');
    expect(calls).toBe(1);
    off();
    setEmojiAssetBase('/cover-b/');
    expect(calls).toBe(1);
  });
});
