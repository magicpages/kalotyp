import { describe, expect, it } from 'vitest';
import type { SourceImage } from '../utility.js';
import { bakeRedact } from './bake.js';

// Only the no-op fast path is reachable from jsdom; the three modes are
// covered pixel-level by the Playwright suite.
describe('bakeRedact', () => {
  it('returns the source unchanged when no regions exist', async () => {
    const fakeBitmap = {} as unknown as SourceImage['bitmap'];
    const source: SourceImage = {
      bitmap: fakeBitmap,
      width: 200,
      height: 200,
      mimeType: 'image/png',
    };
    const baked = await bakeRedact({ regions: [] }, source);
    expect(baked).toBe(source);
  });
});
