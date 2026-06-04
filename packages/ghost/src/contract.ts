/**
 * Type definitions for the Ghost integration contract.
 *
 * Source of truth is the Ghost Ember admin (`koenig-image-editor.js:171-225`)
 * and the Koenig hook (`usePinturaEditor.js:79-134`). See
 * `docs/ghost-contract.md` §3 for every key, the line in Ghost where it's
 * passed, and what Ghost expects it to do.
 */

export type EditorEventName = 'process' | 'loaderror';

export interface ProcessEvent {
  /** The edited image. Ghost reads `result.dest` and nothing else (§4.2). */
  dest: File;
}

export interface LoadErrorEvent {
  message: string;
  cause?: unknown;
}

export type EditorEventPayloads = {
  process: ProcessEvent;
  loaderror: LoadErrorEvent;
};

export type LocaleCallback = (locale: Record<string, string>) => string;
export type FrameStyle = 'solidSharp' | 'solidRound' | 'lineSingle' | 'hook' | 'polaroid';
export type FrameOption = readonly [FrameStyle | undefined, LocaleCallback];
export type CropPreset = readonly [number | undefined, string];
export type CropPresetFilter = 'landscape' | 'portrait';

export interface EditorOptions {
  /** Source image. Always a URL string when called from Ghost (§3 src). */
  src: string | Blob | File;
  enableTransparencyGrid?: boolean;
  util?: string;
  utils?: readonly string[];
  frameOptions?: readonly FrameOption[];
  cropSelectPresetFilter?: CropPresetFilter;
  cropSelectPresetOptions?: readonly CropPreset[];
  locale?: Partial<Record<string, string>>;
  /** Synchronous veto for close requests. Returning false keeps the editor open (§3 willClose, §8.2). */
  willClose?: () => boolean;
  /** Set by Koenig + admin-x-settings, not by the Ember admin (§9). */
  previewPad?: boolean;
  /** Permit unknown keys; we don't crash on extras. */
  [key: string]: unknown;
}

export interface EditorInstance {
  on<K extends EditorEventName>(
    event: K,
    listener: (payload: EditorEventPayloads[K]) => void,
  ): void;
  off<K extends EditorEventName>(
    event: K,
    listener: (payload: EditorEventPayloads[K]) => void,
  ): void;
}
