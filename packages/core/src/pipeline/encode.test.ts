import { describe, expect, it, vi } from 'vitest';
import * as bakeCanvas from '../canvas/bake-canvas.js';
import type { OutputState } from '../output/state.js';
import type { SourceImage } from '../plugins/utility.js';
import { deriveOutputName, resolveOutputMime } from './encode.js';

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

  it('falls back to WebP when the explicit choice (AVIF) is unsupported', async () => {
    stubSupport({ 'image/webp': true, 'image/png': true });
    const state: OutputState = { mimeChoice: 'image/avif', quality: 0.8, stripMetadata: true };
    expect(await resolveOutputMime(state, FAKE_SOURCE as SourceImage)).toBe('image/webp');
  });

  it('falls back to PNG when the explicit choice and WebP are both unsupported', async () => {
    stubSupport({ 'image/png': true });
    const state: OutputState = { mimeChoice: 'image/avif', quality: 0.8, stripMetadata: true };
    expect(await resolveOutputMime(state, FAKE_SOURCE as SourceImage)).toBe('image/png');
  });

  it('auto resolves to WebP when supported', async () => {
    stubSupport({ 'image/webp': true, 'image/png': true });
    const state: OutputState = { mimeChoice: 'auto', quality: 0.8, stripMetadata: true };
    expect(await resolveOutputMime(state, FAKE_SOURCE as SourceImage)).toBe('image/webp');
  });

  it('auto resolves to JPEG for non-alpha sources when WebP is unavailable', async () => {
    stubSupport({ 'image/jpeg': true, 'image/png': true });
    const state: OutputState = { mimeChoice: 'auto', quality: 0.8, stripMetadata: true };
    const jpegSource = { ...FAKE_SOURCE, mimeType: 'image/jpeg' };
    expect(await resolveOutputMime(state, jpegSource as SourceImage)).toBe('image/jpeg');
  });

  it('auto resolves to PNG for alpha-carrying sources when WebP is unavailable', async () => {
    stubSupport({ 'image/jpeg': true, 'image/png': true });
    const state: OutputState = { mimeChoice: 'auto', quality: 0.8, stripMetadata: true };
    const pngSource = { ...FAKE_SOURCE, mimeType: 'image/png' };
    expect(await resolveOutputMime(state, pngSource as SourceImage)).toBe('image/png');
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
