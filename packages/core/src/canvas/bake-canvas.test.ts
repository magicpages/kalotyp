import { afterEach, describe, expect, it, vi } from 'vitest';
import { canEncodeMime } from './bake-canvas.js';

/**
 * Mirrors a real constraint some engines (Chromium) enforce: `convertToBlob`
 * throws "no rendering context" on an OffscreenCanvas that never had
 * `getContext` called on it. Used to catch a regression where `canEncodeMime`
 * probed without establishing a context first, making every format probe a
 * false negative regardless of actual browser support.
 */
class FakeOffscreenCanvas {
  private contextRequested = false;

  getContext(kind: string): object | null {
    if (kind !== '2d') return null;
    this.contextRequested = true;
    return {};
  }

  convertToBlob(options: { type: string; quality: number }): Promise<Blob> {
    if (!this.contextRequested) {
      return Promise.reject(new Error('no rendering context'));
    }
    return Promise.resolve(new Blob(['x'], { type: options.type }));
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('canEncodeMime', () => {
  it('establishes a rendering context before probing, so the check reflects real support', async () => {
    vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas);
    expect(await canEncodeMime('image/x-regression-context-check')).toBe(true);
  });

  it('still resolves false when the runtime genuinely cannot encode the mime', async () => {
    class NoSupportOffscreenCanvas extends FakeOffscreenCanvas {
      override convertToBlob(): Promise<Blob> {
        return Promise.resolve(new Blob(['x'], { type: 'image/png' }));
      }
    }
    vi.stubGlobal('OffscreenCanvas', NoSupportOffscreenCanvas);
    expect(await canEncodeMime('image/x-regression-unsupported')).toBe(false);
  });
});
