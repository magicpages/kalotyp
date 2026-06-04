import { describe, expect, it, vi } from 'vitest';
import type { SourceImage, UtilityPlugin } from '../plugins/utility.js';
import { type ChainLink, runUtilityChain } from './run-chain.js';

function makeSource(width: number, height: number, marker: string): SourceImage {
  return {
    bitmap: { width, height, __marker: marker } as unknown as ImageBitmap,
    width,
    height,
    mimeType: 'image/png',
  };
}

function makePassthroughPlugin(id: 'flip' | 'crop'): UtilityPlugin<object> {
  return {
    id,
    init: () => ({}),
    mount: () => ({ destroy: () => {} }),
    bake: async (_state, source) => source,
  };
}

describe('runUtilityChain', () => {
  it('returns the source unchanged for an empty chain', async () => {
    const source = makeSource(100, 100, 'a');
    const result = await runUtilityChain([], source);
    expect(result).toBe(source);
  });

  it('threads the bake output of each link as the input to the next, in order', async () => {
    const source = makeSource(100, 100, 'a');
    const intermediate = makeSource(50, 50, 'b');
    const final = makeSource(25, 25, 'c');

    const cropBake = vi.fn(async () => intermediate);
    const flipBake = vi.fn(async () => final);

    const links: ChainLink[] = [
      { id: 'crop', plugin: { ...makePassthroughPlugin('crop'), bake: cropBake }, state: {} },
      { id: 'flip', plugin: { ...makePassthroughPlugin('flip'), bake: flipBake }, state: {} },
    ];

    const result = await runUtilityChain(links, source);

    expect(cropBake).toHaveBeenCalledWith(expect.anything(), source);
    expect(flipBake).toHaveBeenCalledWith(expect.anything(), intermediate);
    expect(result).toBe(final);
  });

  it('passes each link its own state object to bake', async () => {
    const source = makeSource(10, 10, 'a');
    const cropState = { rect: { x: 0, y: 0, width: 10, height: 10 } };
    const flipState = { horizontal: true };
    const cropBake = vi.fn(async (_s, src) => src);
    const flipBake = vi.fn(async (_s, src) => src);

    const links: ChainLink[] = [
      {
        id: 'crop',
        plugin: { ...makePassthroughPlugin('crop'), bake: cropBake },
        state: cropState,
      },
      {
        id: 'flip',
        plugin: { ...makePassthroughPlugin('flip'), bake: flipBake },
        state: flipState,
      },
    ];

    await runUtilityChain(links, source);
    expect(cropBake.mock.calls[0]?.[0]).toBe(cropState);
    expect(flipBake.mock.calls[0]?.[0]).toBe(flipState);
  });
});
