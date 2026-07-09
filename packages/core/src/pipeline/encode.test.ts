import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BakeCanvas } from '../canvas/bake-canvas.js';
import * as bakeCanvas from '../canvas/bake-canvas.js';
import * as wasmCodec from '../canvas/wasm-codec.js';
import type { OutputState } from '../output/state.js';
import type { SourceImage } from '../plugins/utility.js';
import { deriveOutputName, encodeSourceImage, resolveOutputMime } from './encode.js';

function stubSupport(support: Record<string, boolean>): void {
  vi.spyOn(bakeCanvas, 'canEncodeMime').mockImplementation((mime: string) =>
    Promise.resolve(support[mime] ?? false),
  );
}

const FAKE_SOURCE: Pick<SourceImage, 'mimeType' | 'width' | 'height'> = {
  mimeType: 'image/jpeg',
  width: 100,
  height: 100,
};

describe('resolveOutputMime', () => {
  it('honours an explicit choice when the runtime can encode it', async () => {
    stubSupport({ 'image/webp': true, 'image/png': true });
    const state: OutputState = { mimeChoice: 'image/webp', quality: 0.8, stripMetadata: true };
    expect(await resolveOutputMime(state, FAKE_SOURCE as SourceImage)).toBe('image/webp');
  });

  it('honours an explicit WebP choice via the WASM fallback when Canvas 2D cannot encode it', async () => {
    stubSupport({ 'image/png': true });
    const state: OutputState = { mimeChoice: 'image/webp', quality: 0.8, stripMetadata: true };
    expect(await resolveOutputMime(state, FAKE_SOURCE as SourceImage)).toBe('image/webp');
  });

  it('honours an explicit AVIF choice via the WASM fallback when Canvas 2D cannot encode it', async () => {
    stubSupport({ 'image/png': true });
    const state: OutputState = { mimeChoice: 'image/avif', quality: 0.8, stripMetadata: true };
    expect(await resolveOutputMime(state, FAKE_SOURCE as SourceImage)).toBe('image/avif');
  });

  it('auto resolves to WebP when supported', async () => {
    stubSupport({ 'image/webp': true, 'image/png': true });
    const state: OutputState = { mimeChoice: 'auto', quality: 0.8, stripMetadata: true };
    expect(await resolveOutputMime(state, FAKE_SOURCE as SourceImage)).toBe('image/webp');
  });

  it('auto resolves to WebP via the WASM fallback even when Canvas 2D cannot encode it', async () => {
    stubSupport({ 'image/jpeg': true, 'image/png': true });
    const state: OutputState = { mimeChoice: 'auto', quality: 0.8, stripMetadata: true };
    expect(await resolveOutputMime(state, FAKE_SOURCE as SourceImage)).toBe('image/webp');
  });
});

describe('encodeSourceImage', () => {
  const FAKE_IMAGE_DATA = { data: new Uint8ClampedArray(4), width: 1, height: 1 } as ImageData;
  const FULL_SOURCE: SourceImage = { ...FAKE_SOURCE, bitmap: {} as ImageBitmap } as SourceImage;

  function stubCanvas(): {
    drawImage: ReturnType<typeof vi.fn>;
    getImageData: ReturnType<typeof vi.fn>;
  } {
    const ctx = {
      drawImage: vi.fn(),
      getImageData: vi.fn().mockReturnValue(FAKE_IMAGE_DATA),
    };
    vi.spyOn(bakeCanvas, 'createBakeCanvas').mockReturnValue({
      kind: 'offscreen',
      canvas: {} as OffscreenCanvas,
    } as BakeCanvas);
    vi.spyOn(bakeCanvas, 'getBakeContext2D').mockReturnValue(
      ctx as unknown as OffscreenCanvasRenderingContext2D,
    );
    return ctx;
  }

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the native canvas encode path when the runtime supports the format', async () => {
    stubCanvas();
    stubSupport({ 'image/webp': true });
    const bakeToBlob = vi
      .spyOn(bakeCanvas, 'bakeCanvasToBlob')
      .mockResolvedValue(new Blob(['x'], { type: 'image/webp' }));
    const wasmEncode = vi.spyOn(wasmCodec, 'encodeWithWasmCodec');
    const state: OutputState = { mimeChoice: 'image/webp', quality: 0.8, stripMetadata: true };

    const file = await encodeSourceImage(FULL_SOURCE, { output: state });

    expect(bakeToBlob).toHaveBeenCalledWith(expect.anything(), 'image/webp', 0.8);
    expect(wasmEncode).not.toHaveBeenCalled();
    expect(file.type).toBe('image/webp');
  });

  it('routes through the WASM codec when the runtime cannot natively encode the format', async () => {
    const ctx = stubCanvas();
    stubSupport({});
    const bakeToBlob = vi.spyOn(bakeCanvas, 'bakeCanvasToBlob');
    const wasmEncode = vi
      .spyOn(wasmCodec, 'encodeWithWasmCodec')
      .mockResolvedValue(new Blob(['x'], { type: 'image/avif' }));
    const state: OutputState = { mimeChoice: 'image/avif', quality: 0.6, stripMetadata: true };

    const file = await encodeSourceImage(FULL_SOURCE, { output: state });

    expect(ctx.getImageData).toHaveBeenCalledWith(0, 0, FULL_SOURCE.width, FULL_SOURCE.height);
    expect(wasmEncode).toHaveBeenCalledWith(FAKE_IMAGE_DATA, 'image/avif', 0.6);
    expect(bakeToBlob).not.toHaveBeenCalled();
    expect(file.type).toBe('image/avif');
  });

  it('propagates a WASM codec failure for an explicit choice rather than silently downgrading the format', async () => {
    stubCanvas();
    stubSupport({});
    vi.spyOn(wasmCodec, 'encodeWithWasmCodec').mockRejectedValue(new Error('network error'));
    const state: OutputState = { mimeChoice: 'image/webp', quality: 0.8, stripMetadata: true };

    await expect(encodeSourceImage(FULL_SOURCE, { output: state })).rejects.toThrow(
      'network error',
    );
  });

  it('retries with a native format when auto mode\'s WASM WebP encode fails', async () => {
    stubCanvas();
    // Native WebP unsupported (forcing the WASM path); native JPEG is.
    stubSupport({ 'image/jpeg': true });
    vi.spyOn(wasmCodec, 'encodeWithWasmCodec').mockRejectedValue(new Error('network error'));
    const bakeToBlob = vi
      .spyOn(bakeCanvas, 'bakeCanvasToBlob')
      .mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' }));
    const state: OutputState = { mimeChoice: 'auto', quality: 0.8, stripMetadata: true };
    const jpegSource: SourceImage = { ...FULL_SOURCE, mimeType: 'image/jpeg' };

    const file = await encodeSourceImage(jpegSource, { output: state });

    expect(bakeToBlob).toHaveBeenCalledWith(expect.anything(), 'image/jpeg', 0.8);
    expect(file.type).toBe('image/jpeg');
  });

  it('retries with PNG when auto mode\'s WASM WebP encode fails on an alpha-carrying source', async () => {
    stubCanvas();
    stubSupport({ 'image/jpeg': true, 'image/png': true });
    vi.spyOn(wasmCodec, 'encodeWithWasmCodec').mockRejectedValue(new Error('network error'));
    const bakeToBlob = vi
      .spyOn(bakeCanvas, 'bakeCanvasToBlob')
      .mockResolvedValue(new Blob(['x'], { type: 'image/png' }));
    const state: OutputState = { mimeChoice: 'auto', quality: 0.8, stripMetadata: true };
    const pngSource: SourceImage = { ...FULL_SOURCE, mimeType: 'image/png' };

    const file = await encodeSourceImage(pngSource, { output: state });

    expect(bakeToBlob).toHaveBeenCalledWith(expect.anything(), 'image/png', 0.8);
    expect(file.type).toBe('image/png');
  });
});

describe('deriveOutputName', () => {
  it('keeps the basename of a URL, replacing the extension to match MIME', () => {
    expect(deriveOutputName('https://cdn.example/path/photo-123.jpg', 'image/jpeg')).toBe(
      'photo-123.jpg',
    );
  });

  it('replaces the extension when the source format differs from the chosen MIME', () => {
    expect(deriveOutputName('https://cdn.example/path/photo.webp', 'image/png')).toBe('photo.png');
  });

  it('renames to .webp when the chosen MIME is WebP', () => {
    expect(deriveOutputName('https://cdn.example/path/photo.png', 'image/webp')).toBe('photo.webp');
  });

  it('renames to .avif when the chosen MIME is AVIF', () => {
    expect(deriveOutputName('https://cdn.example/path/photo.png', 'image/avif')).toBe('photo.avif');
  });

  it('strips a query string from a URL before deriving the basename', () => {
    expect(
      deriveOutputName('https://cdn.example/photo-1761839257469.jpg?v=1777654601688', 'image/jpeg'),
    ).toBe('photo-1761839257469.jpg');
  });

  it('handles a bare filename without a path', () => {
    expect(deriveOutputName('avatar.png', 'image/png')).toBe('avatar.png');
  });

  it('falls back to a default when no source name is given', () => {
    expect(deriveOutputName(undefined, 'image/jpeg')).toBe('kalotyp-image.jpg');
    expect(deriveOutputName(undefined, 'image/png')).toBe('kalotyp-image.png');
    expect(deriveOutputName(undefined, 'image/webp')).toBe('kalotyp-image.webp');
  });

  it('falls back to a default when the path has no segments', () => {
    expect(deriveOutputName('https://cdn.example/', 'image/png')).toBe('kalotyp-image.png');
  });

  it('keeps a stem with no extension and adds the right one', () => {
    expect(deriveOutputName('https://cdn.example/path/photo', 'image/png')).toBe('photo.png');
  });
});
