/* @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureAnnotateFontsLoaded } from './fonts-loader.js';

// jsdom's `document.fonts` doesn't implement the FontFaceSet event API, so
// install a minimal EventTarget-backed stub to exercise the load→repaint path.
beforeEach(() => {
  const target = new EventTarget() as EventTarget & { ready: Promise<unknown> };
  target.ready = Promise.resolve();
  Object.defineProperty(document, 'fonts', { configurable: true, value: target });
});

afterEach(() => {
  document.getElementById('kalotyp-annotate-fonts')?.remove();
  vi.restoreAllMocks();
});

describe('ensureAnnotateFontsLoaded', () => {
  it('injects the Bunny stylesheet link once (idempotent)', () => {
    ensureAnnotateFontsLoaded();
    ensureAnnotateFontsLoaded();
    const links = document.querySelectorAll('#kalotyp-annotate-fonts');
    expect(links.length).toBe(1);
    expect((links[0] as HTMLLinkElement).href).toContain('fonts.bunny.net');
  });

  it('calls onFontsChanged when a font batch finishes loading', () => {
    const onChanged = vi.fn();
    const stop = ensureAnnotateFontsLoaded(onChanged);
    // A web font swaps in async with different metrics; the canvas must repaint
    // on this event or committed text renders stale and "jumps" on next interaction.
    document.fonts.dispatchEvent(new Event('loadingdone'));
    expect(onChanged).toHaveBeenCalled();
    stop();
  });

  it('stops notifying after cleanup', () => {
    const onChanged = vi.fn();
    const stop = ensureAnnotateFontsLoaded(onChanged);
    stop();
    onChanged.mockClear();
    document.fonts.dispatchEvent(new Event('loadingdone'));
    expect(onChanged).not.toHaveBeenCalled();
  });
});
