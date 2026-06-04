/* @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sourceToFile } from './source-image.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('sourceToFile', () => {
  it('returns a File unchanged when one is passed in', async () => {
    const file = new File(['hello'], 'hello.png', { type: 'image/png' });
    const result = await sourceToFile(file);
    expect(result).toBe(file);
  });

  it('wraps a Blob into a File with a name and the original MIME', async () => {
    const blob = new Blob(['hello'], { type: 'image/jpeg' });
    const result = await sourceToFile(blob);
    expect(result).toBeInstanceOf(File);
    expect(result.type).toBe('image/jpeg');
    expect(result.name.length).toBeGreaterThan(0);
  });

  it('fetches a URL and infers the file name from the path', async () => {
    const fetched = new Blob(['x'], { type: 'image/png' });
    const response = {
      ok: true,
      status: 200,
      statusText: 'OK',
      blob: async () => fetched,
    } as unknown as Response;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response),
    );
    const result = await sourceToFile('https://cdn.example/path/photo-1761839257469.png?v=1');
    expect(result).toBeInstanceOf(File);
    expect(result.name).toBe('photo-1761839257469.png');
  });
});
