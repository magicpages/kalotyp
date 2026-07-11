import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  encodeWithWasmCodec,
  isWasmEncodableMime,
  resetWasmCodecCacheForTesting,
} from './wasm-codec.js';
import * as loader from './wasm-codec-loader.js';

const FAKE_IMAGE_DATA = { data: new Uint8ClampedArray(4), width: 1, height: 1 } as ImageData;

beforeEach(() => {
  resetWasmCodecCacheForTesting();
  vi.restoreAllMocks();
});

describe('isWasmEncodableMime', () => {
  it('is true only for webp and avif', () => {
    expect(isWasmEncodableMime('image/webp')).toBe(true);
    expect(isWasmEncodableMime('image/avif')).toBe(true);
    expect(isWasmEncodableMime('image/png')).toBe(false);
    expect(isWasmEncodableMime('image/jpeg')).toBe(false);
  });
});

describe('encodeWithWasmCodec', () => {
  it('maps 0..1 quality to the codec 0..100 scale', async () => {
    const encode = vi.fn().mockResolvedValue(new ArrayBuffer(1));
    vi.spyOn(loader, 'importWebpEncoder').mockResolvedValue({ default: encode });

    await encodeWithWasmCodec(FAKE_IMAGE_DATA, 'image/webp', 0.8);

    expect(encode).toHaveBeenCalledWith(FAKE_IMAGE_DATA, { quality: 80 });
  });

  it('returns a Blob tagged with the requested mime type', async () => {
    const encode = vi.fn().mockResolvedValue(new ArrayBuffer(3));
    vi.spyOn(loader, 'importAvifEncoder').mockResolvedValue({ default: encode });

    const blob = await encodeWithWasmCodec(FAKE_IMAGE_DATA, 'image/avif', 0.5);

    expect(blob.type).toBe('image/avif');
    expect(blob.size).toBe(3);
  });

  it('fetches the codec module only once across repeated encodes', async () => {
    const encode = vi.fn().mockResolvedValue(new ArrayBuffer(1));
    const importWebp = vi.spyOn(loader, 'importWebpEncoder').mockResolvedValue({ default: encode });

    await encodeWithWasmCodec(FAKE_IMAGE_DATA, 'image/webp', 0.8);
    await encodeWithWasmCodec(FAKE_IMAGE_DATA, 'image/webp', 0.5);

    expect(importWebp).toHaveBeenCalledTimes(1);
    expect(encode).toHaveBeenCalledTimes(2);
  });

  it('keeps WebP and AVIF module caches independent', async () => {
    const webpEncode = vi.fn().mockResolvedValue(new ArrayBuffer(1));
    const avifEncode = vi.fn().mockResolvedValue(new ArrayBuffer(1));
    const importWebp = vi
      .spyOn(loader, 'importWebpEncoder')
      .mockResolvedValue({ default: webpEncode });
    const importAvif = vi
      .spyOn(loader, 'importAvifEncoder')
      .mockResolvedValue({ default: avifEncode });

    await encodeWithWasmCodec(FAKE_IMAGE_DATA, 'image/webp', 0.8);
    await encodeWithWasmCodec(FAKE_IMAGE_DATA, 'image/avif', 0.8);

    expect(importWebp).toHaveBeenCalledTimes(1);
    expect(importAvif).toHaveBeenCalledTimes(1);
  });

  it('propagates errors when the codec module fails to load', async () => {
    vi.spyOn(loader, 'importWebpEncoder').mockRejectedValue(new Error('network error'));

    await expect(encodeWithWasmCodec(FAKE_IMAGE_DATA, 'image/webp', 0.8)).rejects.toThrow(
      'network error',
    );
  });

  it('retries the import after a failed load instead of caching the rejection', async () => {
    const encode = vi.fn().mockResolvedValue(new ArrayBuffer(1));
    const importWebp = vi
      .spyOn(loader, 'importWebpEncoder')
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce({ default: encode });

    await expect(encodeWithWasmCodec(FAKE_IMAGE_DATA, 'image/webp', 0.8)).rejects.toThrow(
      'network error',
    );
    await encodeWithWasmCodec(FAKE_IMAGE_DATA, 'image/webp', 0.8);

    expect(importWebp).toHaveBeenCalledTimes(2);
    expect(encode).toHaveBeenCalledWith(FAKE_IMAGE_DATA, { quality: 80 });
  });

  it('propagates errors thrown by the encoder itself', async () => {
    const encode = vi.fn().mockRejectedValue(new Error('Encoding error.'));
    vi.spyOn(loader, 'importWebpEncoder').mockResolvedValue({ default: encode });

    await expect(encodeWithWasmCodec(FAKE_IMAGE_DATA, 'image/webp', 0.8)).rejects.toThrow(
      'Encoding error.',
    );
  });
});
