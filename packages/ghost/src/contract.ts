/**
 * Type definitions for the Ghost integration contract.
 *
 * Source of truth is the Ghost Ember admin (`koenig-image-editor.js:171-225`),
 * the Koenig hook (`usePinturaEditor.js:79-134`) and the React admin hook
 * (`apps/admin/src/hooks/use-pintura-editor.ts:116-151`), which is the only
 * host that tears the editor down itself. See `docs/ghost-contract.md` §3 for
 * every key, the line in Ghost where it's passed, and what Ghost expects it to
 * do.
 */

export type EditorEventName = 'process' | 'loaderror' | 'destroy';

export interface ProcessEvent {
  /** The edited image. Ghost reads `result.dest` and nothing else (§4.2). */
  dest: File;
}

export interface LoadErrorEvent {
  message: string;
  cause?: unknown;
}

/** The editor has torn itself down. Carries no data (see Teardown in the contract doc). */
export type DestroyEvent = Record<string, never>;

export type EditorEventPayloads = {
  process: ProcessEvent;
  loaderror: LoadErrorEvent;
  destroy: DestroyEvent;
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
  /**
   * Tear the editor down and remove it from the DOM, emitting `destroy`.
   * Ghost's React admin calls this when its host component unmounts and when
   * the editor is disabled while open (see Teardown in the contract doc).
   * Unlike the close button it is
   * not vetoable — `willClose` guards user dismissal, and refusing a host's
   * teardown would leak the modal into the next route. Idempotent: a call
   * after the editor already closed itself (Save, or the close button) is a
   * no-op.
   */
  destroy(): void;
}
