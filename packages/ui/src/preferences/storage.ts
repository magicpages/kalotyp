/**
 * Per-site preferences for the editor. Persisted to `localStorage`
 * (browser-origin-scoped automatically); the `siteScope` derived from
 * the Ghost-passed `src` URL further namespaces same-origin-multi-site
 * installs by Ghost-content-root.
 *
 * What's persisted:
 *   - Output format and quality (always, no opt-out — saving the
 *     user's preferred output format is universally useful).
 *   - Annotation default style (colour + stroke width) — opt-in via
 *     `rememberAnnotationStyle`.
 *   - Last-used filter preset id — opt-in via `rememberFilter`.
 *   - Last-used frame preset id and colour — opt-in via
 *     `rememberFrame`.
 *
 * What's *not* persisted:
 *   - The current edit (transient session state — undo/redo handles
 *     in-session reverts).
 *   - The image source (Ghost passes a fresh `src` each open).
 *   - Anything that could leak identity across sessions (no telemetry,
 *     no usage counts).
 *
 * The total payload sits well under 1 KB; quota is not a concern, and
 * even repeated writes-on-commit don't approach `localStorage`'s 5–10 MB
 * per-origin budget.
 */

import type { OutputMimeChoice } from '@magicpages/kalotyp-core';

export interface KalotypPreferences {
  readonly outputMimeChoice: OutputMimeChoice;
  readonly outputQuality: number;
  /**
   * Whether to strip EXIF / GPS / camera metadata on save. Stored
   * alongside the output format so the user's privacy choice
   * survives across sessions like the format and quality do.
   */
  readonly outputStripMetadata: boolean;
  readonly rememberAnnotationStyle: boolean;
  readonly rememberFilter: boolean;
  readonly rememberFrame: boolean;
  readonly lastAnnotationColor: string;
  readonly lastAnnotationStrokeWidth: number;
  readonly lastFilterPresetId: string | null;
  readonly lastFramePresetId: string | null;
  readonly lastFrameColor: string;
}

export const DEFAULT_PREFERENCES: KalotypPreferences = {
  outputMimeChoice: 'auto',
  outputQuality: 0.85,
  outputStripMetadata: true,
  rememberAnnotationStyle: true,
  rememberFilter: true,
  rememberFrame: true,
  lastAnnotationColor: '#ff3b30',
  lastAnnotationStrokeWidth: 4,
  lastFilterPresetId: null,
  lastFramePresetId: null,
  lastFrameColor: '#000000',
};

/**
 * Schema version baked into the storage key. Bumped if the shape
 * changes incompatibly — older saved payloads then fail their JSON
 * parse and fall back to defaults rather than producing an
 * ambiguous mix of fields.
 */
const STORAGE_KEY_PREFIX = 'kalotyp:prefs:v1';

/**
 * Derive a stable per-site scope identifier from the `src` option
 * Ghost passes. Used as the suffix on the `localStorage` key so two
 * Ghost installs on the same origin (rare but possible, e.g. a host
 * serving `/site-a/` and `/site-b/` Ghost instances) get separate
 * preferences.
 *
 * Strategy:
 *   - URL `src`: use `origin + the leading path up to (and excluding)
 *     `/content/`. Ghost serves images at `<origin>/content/images/...`,
 *     so the prefix uniquely identifies a Ghost root.
 *   - Blob/File `src` (test environments, future direct-feed
 *     scenarios): fall back to `window.location.origin`.
 *   - Anything else falls to `'default'` so the read still succeeds.
 */
export function getSiteScope(srcOption: unknown): string {
  if (typeof srcOption === 'string') {
    try {
      const url = new URL(srcOption);
      const path = url.pathname;
      const contentIdx = path.indexOf('/content/');
      const root = contentIdx === -1 ? '' : path.slice(0, contentIdx);
      return `${url.origin}${root}`;
    } catch {
      // Fall through.
    }
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'default';
}

function storageKey(siteScope: string): string {
  return `${STORAGE_KEY_PREFIX}:${siteScope}`;
}

/**
 * Load preferences for `siteScope`. Missing keys fill from defaults
 * (sparse merge) so a partial historical payload doesn't break the
 * editor. Any read error (no storage, quota, parse failure) returns
 * the defaults — preferences are best-effort.
 */
export function loadPreferences(siteScope: string): KalotypPreferences {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_PREFERENCES;
    const raw = localStorage.getItem(storageKey(siteScope));
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<KalotypPreferences>;
    return mergeWithDefaults(parsed);
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

/**
 * Save preferences for `siteScope`. Writes are best-effort: quota
 * errors and missing storage are swallowed so a failed save never
 * crashes the editor. Validation happens here too — any non-finite
 * or out-of-range value is replaced with the default before write.
 */
export function savePreferences(siteScope: string, prefs: KalotypPreferences): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const sanitised = mergeWithDefaults(prefs);
    localStorage.setItem(storageKey(siteScope), JSON.stringify(sanitised));
  } catch {
    // Quota exceeded, storage disabled, etc. Best-effort: ignore.
  }
}

function mergeWithDefaults(partial: Partial<KalotypPreferences>): KalotypPreferences {
  const outputMimeChoice = isOutputMimeChoice(partial.outputMimeChoice)
    ? partial.outputMimeChoice
    : DEFAULT_PREFERENCES.outputMimeChoice;
  const outputQuality = clampToRange(
    partial.outputQuality,
    0,
    1,
    DEFAULT_PREFERENCES.outputQuality,
  );
  const outputStripMetadata =
    typeof partial.outputStripMetadata === 'boolean'
      ? partial.outputStripMetadata
      : DEFAULT_PREFERENCES.outputStripMetadata;
  const rememberAnnotationStyle =
    typeof partial.rememberAnnotationStyle === 'boolean'
      ? partial.rememberAnnotationStyle
      : DEFAULT_PREFERENCES.rememberAnnotationStyle;
  const rememberFilter =
    typeof partial.rememberFilter === 'boolean'
      ? partial.rememberFilter
      : DEFAULT_PREFERENCES.rememberFilter;
  const rememberFrame =
    typeof partial.rememberFrame === 'boolean'
      ? partial.rememberFrame
      : DEFAULT_PREFERENCES.rememberFrame;
  const lastAnnotationColor =
    typeof partial.lastAnnotationColor === 'string'
      ? partial.lastAnnotationColor
      : DEFAULT_PREFERENCES.lastAnnotationColor;
  const lastAnnotationStrokeWidth = clampToRange(
    partial.lastAnnotationStrokeWidth,
    1,
    40,
    DEFAULT_PREFERENCES.lastAnnotationStrokeWidth,
  );
  const lastFilterPresetId =
    partial.lastFilterPresetId === null || typeof partial.lastFilterPresetId === 'string'
      ? partial.lastFilterPresetId
      : DEFAULT_PREFERENCES.lastFilterPresetId;
  const lastFramePresetId =
    partial.lastFramePresetId === null || typeof partial.lastFramePresetId === 'string'
      ? partial.lastFramePresetId
      : DEFAULT_PREFERENCES.lastFramePresetId;
  const lastFrameColor =
    typeof partial.lastFrameColor === 'string'
      ? partial.lastFrameColor
      : DEFAULT_PREFERENCES.lastFrameColor;

  return {
    outputMimeChoice,
    outputQuality,
    outputStripMetadata,
    rememberAnnotationStyle,
    rememberFilter,
    rememberFrame,
    lastAnnotationColor,
    lastAnnotationStrokeWidth,
    lastFilterPresetId,
    lastFramePresetId,
    lastFrameColor,
  };
}

function isOutputMimeChoice(value: unknown): value is OutputMimeChoice {
  return (
    value === 'auto' ||
    value === 'image/png' ||
    value === 'image/jpeg' ||
    value === 'image/webp' ||
    value === 'image/avif'
  );
}

function clampToRange(value: unknown, lo: number, hi: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  if (value < lo) return lo;
  if (value > hi) return hi;
  return value;
}
