import { bakeCanvasToBlob, canEncodeMime, createBakeCanvas } from '../canvas/bake-canvas.js';
import { clampQuality, DEFAULT_OUTPUT_STATE, type OutputState } from '../output/state.js';
import type { SourceImage } from '../plugins/utility.js';
import { copyJpegExif } from './exif.js';

const FALLBACK_MIME = 'image/png';

// Source formats Kalotyp can re-encode one-to-one. `'auto'` keeps the source's
// own format so an edit never silently changes an image's type: Ghost serves
// the saved file straight into newsletters, and email clients (notably Outlook
// Classic, whose Word engine renders no WebP/AVIF) cannot decode those formats.
// A JPEG must stay a JPEG even though WebP would be smaller.
const SOURCE_FORMAT_BY_MIME: Partial<Record<string, string>> = {
  'image/jpeg': 'image/jpeg',
  'image/png': 'image/png',
  'image/webp': 'image/webp',
  'image/avif': 'image/avif',
};

// Sources with no canvas encoder (GIF, SVG, BMP, …) and unrecognised formats
// fall back by alpha. SVG is included because it routinely carries transparency
// and rasterises onto an alpha canvas; GIF likewise. Resolving those to JPEG
// would flatten the background to black. WebP/AVIF stay listed for the case
// where the runtime cannot encode them and they fall through to the fallback.
const ALPHA_CARRYING_SOURCE_MIMES: Record<string, true> = {
  'image/png': true,
  'image/webp': true,
  'image/avif': true,
  'image/gif': true,
  'image/svg+xml': true,
};

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
 * Explicit choices fall back to WebP then PNG. `'auto'` preserves the source
 * format when the runtime can encode it (JPEG stays JPEG — never silently
 * rewritten to WebP, which Ghost would then serve into newsletters that email
 * clients cannot decode); otherwise it falls back by alpha: JPEG for opaque
 * sources, PNG otherwise.
 */
export async function resolveOutputMime(state: OutputState, source: SourceImage): Promise<string> {
  if (state.mimeChoice !== 'auto') {
    if (await canEncodeMime(state.mimeChoice)) return state.mimeChoice;
    if (await canEncodeMime('image/webp')) return 'image/webp';
    return FALLBACK_MIME;
  }
  const sourceFormat = SOURCE_FORMAT_BY_MIME[source.mimeType];
  if (sourceFormat && (await canEncodeMime(sourceFormat))) return sourceFormat;
  const sourceHasAlpha = ALPHA_CARRYING_SOURCE_MIMES[source.mimeType] === true;
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
  const name = deriveOutputName(options.sourceName, mimeType);
  const bake = createBakeCanvas(source.width, source.height);
  if (bake.kind === 'offscreen') {
    const ctx = bake.canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context is not available');
    ctx.drawImage(source.bitmap, 0, 0);
  } else {
    const ctx = bake.canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context is not available');
    ctx.drawImage(source.bitmap, 0, 0);
  }
  const baseBlob = await bakeCanvasToBlob(bake, mimeType, quality);
  // EXIF can only be re-attached on JPEG → JPEG; canvas re-encoding strips
  // unconditionally, so this is the only place metadata can survive.
  const shouldPreserveMetadata =
    options.output?.stripMetadata === false &&
    mimeType === 'image/jpeg' &&
    source.mimeType === 'image/jpeg' &&
    options.sourceBlob !== undefined;
  const blob = shouldPreserveMetadata
    ? await copyJpegExif({ source: options.sourceBlob as Blob, output: baseBlob })
    : baseBlob;
  return new File([blob], name, { type: mimeType });
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
