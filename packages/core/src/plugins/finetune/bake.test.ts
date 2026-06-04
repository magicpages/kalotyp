import { describe, expect, it } from 'vitest';
import type { SourceImage } from '../utility.js';
import { bakeFinetune } from './bake.js';
import { DEFAULT_FINETUNE_STATE, setFinetune } from './state.js';

// Only the no-op fast path is reachable from jsdom; non-trivial bakes are
// exercised by math.test.ts and the Playwright spec.
describe('bakeFinetune', () => {
  it('returns the source unchanged when state is the default', async () => {
    const fakeBitmap = {} as unknown as SourceImage['bitmap'];
    const source: SourceImage = {
      bitmap: fakeBitmap,
      width: 64,
      height: 48,
      mimeType: 'image/png',
    };
    const result = await bakeFinetune(DEFAULT_FINETUNE_STATE, source);
    expect(result).toBe(source);
  });

  it('returns the source unchanged when state collapses back to default', async () => {
    const fakeBitmap = {} as unknown as SourceImage['bitmap'];
    const source: SourceImage = {
      bitmap: fakeBitmap,
      width: 32,
      height: 32,
      mimeType: 'image/jpeg',
    };
    let state = setFinetune(DEFAULT_FINETUNE_STATE, 'brightness', 25);
    state = setFinetune(state, 'brightness', 0);
    const result = await bakeFinetune(state, source);
    expect(result).toBe(source);
  });
});
