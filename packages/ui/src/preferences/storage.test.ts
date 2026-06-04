/* @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PREFERENCES, getSiteScope, loadPreferences, savePreferences } from './storage.js';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe('getSiteScope', () => {
  it('extracts origin + content-root prefix from a Ghost content URL', () => {
    const src = 'https://www.example.com/content/images/2026/01/photo.jpg';
    expect(getSiteScope(src)).toBe('https://www.example.com');
  });

  it('preserves a non-root content path prefix', () => {
    const src = 'https://example.com/blog/content/images/photo.jpg';
    expect(getSiteScope(src)).toBe('https://example.com/blog');
  });

  it('handles a URL without /content/ by using just the origin', () => {
    const src = 'https://example.com/some/other/photo.jpg';
    expect(getSiteScope(src)).toBe('https://example.com');
  });

  it('falls back to window.location.origin for a Blob src', () => {
    const blob = new Blob([], { type: 'image/png' });
    expect(getSiteScope(blob)).toBe(window.location.origin);
  });

  it('returns a stable scope when given garbage', () => {
    expect(typeof getSiteScope(null)).toBe('string');
    expect(typeof getSiteScope(undefined)).toBe('string');
    expect(typeof getSiteScope({})).toBe('string');
  });
});

describe('loadPreferences / savePreferences', () => {
  it('returns defaults when no prefs are stored', () => {
    expect(loadPreferences('site-a')).toEqual(DEFAULT_PREFERENCES);
  });

  it('round-trips a full payload', () => {
    const prefs = {
      ...DEFAULT_PREFERENCES,
      outputMimeChoice: 'image/webp' as const,
      outputQuality: 0.7,
      lastAnnotationColor: '#00ff00',
    };
    savePreferences('site-a', prefs);
    expect(loadPreferences('site-a')).toEqual(prefs);
  });

  it('site scopes do not share preferences', () => {
    savePreferences('site-a', { ...DEFAULT_PREFERENCES, outputQuality: 0.5 });
    savePreferences('site-b', { ...DEFAULT_PREFERENCES, outputQuality: 0.9 });
    expect(loadPreferences('site-a').outputQuality).toBe(0.5);
    expect(loadPreferences('site-b').outputQuality).toBe(0.9);
  });

  it('sparse-fills missing keys from defaults', () => {
    localStorage.setItem(
      'kalotyp:prefs:v1:site-a',
      JSON.stringify({ outputMimeChoice: 'image/jpeg' }),
    );
    const prefs = loadPreferences('site-a');
    expect(prefs.outputMimeChoice).toBe('image/jpeg');
    expect(prefs.outputQuality).toBe(DEFAULT_PREFERENCES.outputQuality);
    expect(prefs.rememberAnnotationStyle).toBe(DEFAULT_PREFERENCES.rememberAnnotationStyle);
  });

  it('returns defaults on a corrupt JSON payload', () => {
    localStorage.setItem('kalotyp:prefs:v1:site-a', '{not-json');
    expect(loadPreferences('site-a')).toEqual(DEFAULT_PREFERENCES);
  });

  it('rejects invalid output mime choices', () => {
    localStorage.setItem(
      'kalotyp:prefs:v1:site-a',
      JSON.stringify({ outputMimeChoice: 'application/x-gibberish' }),
    );
    expect(loadPreferences('site-a').outputMimeChoice).toBe(DEFAULT_PREFERENCES.outputMimeChoice);
  });

  it('clamps out-of-range quality values', () => {
    localStorage.setItem('kalotyp:prefs:v1:site-a', JSON.stringify({ outputQuality: 5 }));
    expect(loadPreferences('site-a').outputQuality).toBe(1);
  });
});
