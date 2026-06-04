import { describe, expect, it } from 'vitest';
import { copyJpegExif } from './exif.js';

function bytesToBlob(bytes: number[], type: string): Blob {
  return new Blob([new Uint8Array(bytes)], { type });
}

/** Some jsdom versions lack `Blob.arrayBuffer()`, so the test reads via FileReader. */
function readBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (result instanceof ArrayBuffer) {
        resolve(new Uint8Array(result));
      } else {
        reject(new Error('FileReader returned a non-ArrayBuffer result'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsArrayBuffer(blob);
  });
}

function makeJpegWithExif(): Blob {
  return bytesToBlob(
    [
      0xff,
      0xd8,
      0xff,
      0xe1,
      0x00,
      0x0c, // APP1 marker, length=12 (includes the 2 length bytes)
      0x45,
      0x78,
      0x69,
      0x66,
      0x00,
      0x00, // "Exif\0\0"
      0x41,
      0x42,
      0x43,
      0x44, // payload
      0xff,
      0xd9, // EOI
    ],
    'image/jpeg',
  );
}

function makeJpegWithoutExif(): Blob {
  return bytesToBlob([0xff, 0xd8, 0xff, 0xd9], 'image/jpeg');
}

describe('copyJpegExif', () => {
  it('splices the source EXIF APP1 segment into the output JPEG', async () => {
    const source = makeJpegWithExif();
    const output = makeJpegWithoutExif();
    const merged = await copyJpegExif({ source, output });
    const bytes = await readBytes(merged);
    expect(bytes.length).toBe(2 + 14 + 2);
    expect(Array.from(bytes.subarray(0, 2))).toEqual([0xff, 0xd8]);
    expect(Array.from(bytes.subarray(2, 4))).toEqual([0xff, 0xe1]);
    expect(Array.from(bytes.subarray(2 + 14))).toEqual([0xff, 0xd9]);
  });

  it('returns the output unchanged when the source is not a JPEG', async () => {
    const source = bytesToBlob([0x89, 0x50, 0x4e, 0x47], 'image/png');
    const output = makeJpegWithoutExif();
    const merged = await copyJpegExif({ source, output });
    expect(merged).toBe(output);
  });

  it('returns the output unchanged when the source has no EXIF segment', async () => {
    const source = makeJpegWithoutExif();
    const output = makeJpegWithoutExif();
    const merged = await copyJpegExif({ source, output });
    expect(merged).toBe(output);
  });

  it('returns the output unchanged when the output is not a JPEG', async () => {
    const source = makeJpegWithExif();
    const output = bytesToBlob([0x89, 0x50, 0x4e, 0x47], 'image/png');
    const merged = await copyJpegExif({ source, output });
    expect(merged).toBe(output);
  });

  it('returns the output unchanged when the source is too short', async () => {
    const source = bytesToBlob([0xff], 'image/jpeg');
    const output = makeJpegWithoutExif();
    const merged = await copyJpegExif({ source, output });
    expect(merged).toBe(output);
  });

  it('skips a non-EXIF APP1 segment (e.g. XMP) and returns unchanged when no EXIF segment follows', async () => {
    const source = bytesToBlob(
      [
        0xff,
        0xd8,
        0xff,
        0xe1,
        0x00,
        0x0c,
        0x68,
        0x74,
        0x74,
        0x70,
        0x3a,
        0x2f, // "http:/"
        0x41,
        0x42,
        0x43,
        0x44,
        0xff,
        0xd9,
      ],
      'image/jpeg',
    );
    const output = makeJpegWithoutExif();
    const merged = await copyJpegExif({ source, output });
    expect(merged).toBe(output);
  });
});
