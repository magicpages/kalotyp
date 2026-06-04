/**
 * `'auto'` resolves to the smallest format that preserves alpha on the
 * current runtime (WebP on evergreens, PNG fallback). AVIF never auto-
 * resolves; the user must pick it explicitly.
 */
export type OutputMimeChoice = 'auto' | 'image/png' | 'image/jpeg' | 'image/webp' | 'image/avif';

export interface OutputState {
  readonly mimeChoice: OutputMimeChoice;
  /** 0.0 – 1.0. Ignored for PNG (lossless). */
  readonly quality: number;
  /**
   * Strip EXIF / GPS / camera metadata on save. Canvas `convertToBlob`
   * already strips EXIF; when `false`, we attempt to preserve the source
   * EXIF segment, which only works for JPEG → JPEG. Other combinations
   * strip regardless — the toggle is a hint, not a guarantee.
   */
  readonly stripMetadata: boolean;
}

export const DEFAULT_OUTPUT_STATE: OutputState = {
  mimeChoice: 'auto',
  quality: 0.85,
  stripMetadata: true,
};

/** The four concrete mime types the user can pick from in the popover. */
export const ENCODABLE_MIMES: ReadonlyArray<Exclude<OutputMimeChoice, 'auto'>> = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/avif',
];

/** Clamp a quality value to [0, 1]; non-finite inputs return the default. */
export function clampQuality(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_OUTPUT_STATE.quality;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function setOutputMime(state: OutputState, mimeChoice: OutputMimeChoice): OutputState {
  if (state.mimeChoice === mimeChoice) return state;
  return { ...state, mimeChoice };
}

export function setOutputQuality(state: OutputState, quality: number): OutputState {
  const clamped = clampQuality(quality);
  if (state.quality === clamped) return state;
  return { ...state, quality: clamped };
}

export function setStripMetadata(state: OutputState, stripMetadata: boolean): OutputState {
  if (state.stripMetadata === stripMetadata) return state;
  return { ...state, stripMetadata };
}
