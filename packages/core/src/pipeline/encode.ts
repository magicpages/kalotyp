import {
  bakeCanvasToBlob,
  canEncodeMime,
  createBakeCanvas,
  getBakeContext2D,
} from '../canvas/bake-canvas.js';
import { encodeWithWasmCodec, isWasmEncodableMime } from '../canvas/wasm-codec.js';
import { clampQuality, DEFAULT_OUTPUT_STATE, type OutputState } from '../output/state.js';
import type { SourceImage } from '../plugins/utility.js';
import { copyJpegExif } from './exif.js';

const FALLBACK_MIME = 'image/png';

const ALPHA_CARRYING_SOURCE_MIMES = new Set(['image/png', 'image/webp', 'image/avif']);

/**
 * WebP/AVIF are always producible: natively where Canvas 2D supports them,
 * otherwise via the WASM codec fallback (`wasm-codec.ts`). Only PNG/JPEG
 * still depend on the runtime's actual Canvas support.
 */
async function canProduceMime(mimeType: string): Promise<boolean> {
  if (isWasmEncodableMime(mimeType)) return true;
  return canEncodeMime(mimeType);
}

export interface EncodeOptions {
  /** Original source URL or filename, if any — used to derive the output name. */
  readonly sourceName?: string;
  /** Output format + quality. Defaults to the auto-resolved mime at default quality. */
  readonly output?: OutputState;
  /**
   * Original source blob, retained so EXIF can be preserved on JPEG → JPEG
   * when the user opts out of stripping. Optional; when missing, EXIF is
   * always stripped (the canvas re-encode strips unconditionally).
   */
  readonly sourceBlob?: Blob;
}

/**
 * Resolve the concrete output mime from `OutputState` against runtime support.
 * Explicit choices fall back to WebP then PNG; `'auto'` prefers WebP.
 *
 * WebP is always producible per `canProduceMime` (native or WASM), so
 * `'auto'` always resolves to it here — this function can't know in advance
 * whether a network-dependent WASM fetch will actually succeed. If it
 * doesn't, `encodeSourceImage` retries with `resolveNativeFallbackMime`
 * instead of this function pre-committing to a fallback it can't verify.
 * `source` is kept in the signature for API stability (this is part of the
 * package's public surface, re-exported from `index.ts`) even though this
 * implementation no longer needs to inspect it.
 */
export async function resolveOutputMime(state: OutputState, _source: SourceImage): Promise<string> {
  if (state.mimeChoice !== 'auto') {
    if (await canProduceMime(state.mimeChoice)) return state.mimeChoice;
    if (await canProduceMime('image/webp')) return 'image/webp';
    return FALLBACK_MIME;
  }
  return 'image/webp';
}

/**
 * The best format `encodeSourceImage` can produce without the WASM codec —
 * JPEG for non-alpha sources when natively supported, otherwise PNG. Used
 * when auto mode's preferred WebP encode fails at the WASM step.
 */
async function resolveNativeFallbackMime(source: SourceImage): Promise<string> {
  const sourceHasAlpha = ALPHA_CARRYING_SOURCE_MIMES.has(source.mimeType);
  if (!sourceHasAlpha && (await canEncodeMime('image/jpeg'))) return 'image/jpeg';
  return FALLBACK_MIME;
}

/**
 * Derive the output filename. `name.ext` → `name.<ext-of-mime>`,
 * otherwise `kalotyp-image.<ext>`.
 */
export function deriveOutputName(sourceName: string | undefined, mimeType: string): string {
  const ext = extensionForMime(mimeType);
  if (!sourceName) return `kalotyp-image.${ext}`;
  const basename = lastPathSegment(sourceName);
  if (!basename) return `kalotyp-image.${ext}`;
  const stem = stripExtension(basename);
  if (!stem) return `kalotyp-image.${ext}`;
  return `${stem}.${ext}`;
}

export async function encodeSourceImage(
  source: SourceImage,
  options: EncodeOptions = {},
): Promise<File> {
  const outputState = options.output ?? DEFAULT_OUTPUT_STATE;
  const mimeType = await resolveOutputMime(outputState, source);
  const quality = clampQuality(outputState.quality);
  const bake = createBakeCanvas(source.width, source.height);
  const ctx = getBakeContext2D(bake);
  ctx.drawImage(source.bitmap, 0, 0);

  let resolvedMime = mimeType;
  let baseBlob: Blob;
  if (isWasmEncodableMime(mimeType) && !(await canEncodeMime(mimeType))) {
    try {
      baseBlob = await encodeWithWasmCodec(
        ctx.getImageData(0, 0, source.width, source.height),
        mimeType,
        quality,
      );
    } catch (error) {
      // 'auto' never committed the user to a specific format, so retry with
      // whatever the browser can encode natively rather than fail the save
      // outright. An explicit choice (the user picked WebP/AVIF by name) is
      // not retried — its failure propagates so the user isn't silently
      // handed a different format than the one they asked for.
      if (outputState.mimeChoice !== 'auto') throw error;
      resolvedMime = await resolveNativeFallbackMime(source);
      baseBlob = await bakeCanvasToBlob(bake, resolvedMime, quality);
    }
  } else {
    baseBlob = await bakeCanvasToBlob(bake, mimeType, quality);
  }

  const name = deriveOutputName(options.sourceName, resolvedMime);
  // EXIF can only be re-attached on JPEG → JPEG; canvas re-encoding strips
  // unconditionally, so this is the only place metadata can survive.
  const shouldPreserveMetadata =
    options.output?.stripMetadata === false &&
    resolvedMime === 'image/jpeg' &&
    source.mimeType === 'image/jpeg' &&
    options.sourceBlob !== undefined;
  const blob = shouldPreserveMetadata
    ? await copyJpegExif({ source: options.sourceBlob as Blob, output: baseBlob })
    : baseBlob;
  return new File([blob], name, { type: resolvedMime });
}

function extensionForMime(mime: string): string {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/avif') return 'avif';
  const subtype = mime.split('/')[1];
  return subtype && subtype.length > 0 ? subtype : 'bin';
}

function lastPathSegment(name: string): string | undefined {
  const trimmed = stripQuery(name);
  const segments = trimmed.split(/[/\\]/);
  return segments[segments.length - 1];
}

function stripQuery(name: string): string {
  const q = name.indexOf('?');
  return q === -1 ? name : name.slice(0, q);
}

function stripExtension(basename: string): string {
  const dot = basename.lastIndexOf('.');
  if (dot <= 0) return basename;
  return basename.slice(0, dot);
}
