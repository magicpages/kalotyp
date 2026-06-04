import { describe, expect, it } from 'vitest';
import type { SourceImage } from '../utility.js';
import { bakeFrame, frameOutputSize } from './bake.js';
import { DEFAULT_FRAME_STATE, FRAME_PRESETS } from './state.js';

// Only the no-op fast path is reachable from jsdom; per-preset pixel
// correctness is covered by the Playwright suite.
describe('bakeFrame', () => {
  it('returns the source unchanged when the preset is "none"', async () => {
    const fakeBitmap = {} as unknown as SourceImage['bitmap'];
    const source: SourceImage = {
      bitmap: fakeBitmap,
      width: 200,
      height: 200,
      mimeType: 'image/png',
    };
    const baked = await bakeFrame(DEFAULT_FRAME_STATE, source);
    expect(baked).toBe(source);
  });
});

describe('frameOutputSize', () => {
  it('returns input dimensions for non-polaroid presets', () => {
    for (const preset of FRAME_PRESETS) {
      if (preset.id === 'polaroid') continue;
      expect(frameOutputSize(preset.id, 100, 200)).toEqual({ width: 100, height: 200 });
    }
  });

  it('expands dimensions correctly for polaroid', () => {
    expect(frameOutputSize('polaroid', 100, 200)).toEqual({ width: 110, height: 223 });
    expect(frameOutputSize('polaroid', 300, 200)).toEqual({ width: 320, height: 246 });
  });

  it('expands by a non-uniform amount on a square so the result is taller than wide', () => {
    const out = frameOutputSize('polaroid', 400, 400);
    expect(out.width).toBe(440);
    expect(out.height).toBe(492);
    expect(out.height).toBeGreaterThan(out.width);
  });
});
