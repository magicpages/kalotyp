/* @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { awaitFontsForBake } from './bake.js';
import type { TextShape } from './state.js';

const TEXT: TextShape = {
  id: 't',
  kind: 'text',
  x: 0,
  y: 0,
  text: 'hi',
  fontSize: 32,
  color: '#000',
  textAlign: 'left',
  fontFamily: 'inter',
  fontWeight: 'normal',
  fontStyle: 'normal',
};

function stubFonts(load: (spec: string) => Promise<unknown>): () => void {
  const fonts = { load, ready: Promise.resolve() };
  Object.defineProperty(document, 'fonts', { configurable: true, value: fonts });
  return () => {
    // Remove the stub so it doesn't leak into other tests.
    Reflect.deleteProperty(document, 'fonts');
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('awaitFontsForBake', () => {
  it('resolves (does not throw) when a font fetch rejects — Save must fall back, not fail', async () => {
    const restore = stubFonts(() => Promise.reject(new Error('woff2 fetch failed')));
    await expect(awaitFontsForBake([TEXT])).resolves.toBeUndefined();
    restore();
  });

  it('resolves via the timeout when font loading never settles', async () => {
    vi.useFakeTimers();
    const restore = stubFonts(() => new Promise(() => {})); // never settles
    const pending = awaitFontsForBake([TEXT]);
    await vi.advanceTimersByTimeAsync(500); // past FONT_LOAD_TIMEOUT_MS (400)
    await expect(pending).resolves.toBeUndefined();
    restore();
  });

  it('is a no-op when there are no text shapes', async () => {
    const load = vi.fn(() => Promise.resolve());
    const restore = stubFonts(load);
    await expect(awaitFontsForBake([])).resolves.toBeUndefined();
    expect(load).not.toHaveBeenCalled();
    restore();
  });

  it('is a no-op when document.fonts is unavailable', async () => {
    // No stub installed; jsdom has no FontFaceSet → the guard returns early.
    Reflect.deleteProperty(document, 'fonts');
    await expect(awaitFontsForBake([TEXT])).resolves.toBeUndefined();
  });
});
