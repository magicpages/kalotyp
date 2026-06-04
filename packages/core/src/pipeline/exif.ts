/**
 * Minimal JPEG EXIF segment copier. Extracts the EXIF APP1 segment from
 * the source JPEG and splices it into the output JPEG right after the
 * SOI marker. JPEG → JPEG only; any other combination returns the output
 * untouched. Canvas-encoded JPEGs never carry EXIF, so no duplicate-APP1
 * risk.
 */

const SOI = [0xff, 0xd8];
const APP1_MARKER = [0xff, 0xe1];
const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"

export interface CopyJpegExifOptions {
  /** The source JPEG bytes (with EXIF). */
  readonly source: Blob;
  /** The freshly-encoded canvas output (no EXIF). */
  readonly output: Blob;
}

/** Splice the source's EXIF APP1 segment into the output JPEG. Returns the output unchanged on any mismatch. */
export async function copyJpegExif(options: CopyJpegExifOptions): Promise<Blob> {
  if (options.output.type && options.output.type !== 'image/jpeg') return options.output;

  const sourceBytes = await readBlobBytes(options.source);
  if (!startsWith(sourceBytes, SOI)) return options.output;

  const exifSegment = findExifApp1(sourceBytes);
  if (!exifSegment) return options.output;

  const outputBytes = await readBlobBytes(options.output);
  if (!startsWith(outputBytes, SOI)) return options.output;

  // [SOI][EXIF segment][rest of output after SOI]
  const merged = new Uint8Array(outputBytes.length + exifSegment.length);
  merged.set(outputBytes.subarray(0, 2), 0);
  merged.set(exifSegment, 2);
  merged.set(outputBytes.subarray(2), 2 + exifSegment.length);

  return new Blob([merged], { type: 'image/jpeg' });
}

/** `Blob.arrayBuffer()` path; falls back to `FileReader` for jsdom which lacks `arrayBuffer`. */
async function readBlobBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') {
    return new Uint8Array(await blob.arrayBuffer());
  }
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

function startsWith(bytes: Uint8Array, prefix: ReadonlyArray<number>): boolean {
  if (bytes.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (bytes[i] !== prefix[i]) return false;
  }
  return true;
}

/** Walk JPEG segments and return the EXIF APP1 segment (FF E1 + length + payload), or undefined. */
function findExifApp1(bytes: Uint8Array): Uint8Array | undefined {
  let i = 2; // skip SOI
  while (i + 4 <= bytes.length) {
    if (bytes[i] !== 0xff) return undefined;
    const marker = bytes[i + 1];
    if (marker === undefined) return undefined;
    // SOS (FF DA) starts compressed data; EOI (FF D9) ends the stream.
    if (marker === 0xda) return undefined;
    if (marker === 0xd9) return undefined;
    const length =
      bytes[i + 2] !== undefined && bytes[i + 3] !== undefined
        ? (bytes[i + 2] as number) * 256 + (bytes[i + 3] as number)
        : 0;
    if (length < 2) return undefined;
    const segmentEnd = i + 2 + length;
    if (segmentEnd > bytes.length) return undefined;

    if (
      bytes[i] === APP1_MARKER[0] &&
      bytes[i + 1] === APP1_MARKER[1] &&
      hasExifHeader(bytes, i + 4)
    ) {
      return bytes.slice(i, segmentEnd);
    }

    i = segmentEnd;
  }
  return undefined;
}

function hasExifHeader(bytes: Uint8Array, offset: number): boolean {
  for (let j = 0; j < EXIF_HEADER.length; j++) {
    if (bytes[offset + j] !== EXIF_HEADER[j]) return false;
  }
  return true;
}
