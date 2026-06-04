import type { ViewportController } from '../canvas/viewport-controller.js';
import type { EventBus } from '../events/event-bus.js';
import type { Store } from '../state/store.js';

/**
 * Internal utility id taxonomy. Includes the ids Ghost enumerates in
 * `options.utils` plus `'rotate'` and `'flip'`, which Kalotyp ships as
 * separate utilities (Ghost's array is the set it wants exposed, not the
 * upper bound on what the editor may render).
 */
export type UtilityId =
  | 'crop'
  | 'rotate'
  | 'flip'
  | 'filter'
  | 'finetune'
  | 'redact'
  | 'annotate'
  | 'trim'
  | 'frame'
  | 'resize';

/** Normalised wrapper around an image inside the bake chain. `bitmap` is anything `drawImage` accepts. */
export interface SourceImage {
  readonly bitmap: ImageBitmap | HTMLImageElement | HTMLCanvasElement | OffscreenCanvas;
  readonly width: number;
  readonly height: number;
  readonly mimeType: string;
}

export interface UtilityHandle {
  destroy(): void;
}

/**
 * Editor → plugin / plugin → editor channel. `commit` signals a state
 * change worth re-rendering; `announce` requests a polite-live-region
 * announcement forwarded to the shell's screen-reader announcer.
 */
export type EditorEvents = {
  commit: { readonly utility: UtilityId };
  announce: { readonly message: string };
};

export interface UtilityContext {
  readonly source: SourceImage;
  readonly bus: EventBus<EditorEvents>;
  /**
   * Editor-level zoom + pan controller. Plugins read viewports via
   * `viewport.computeViewport(stage, image)` and subscribe for repaint;
   * the editor's gesture detector owns mutation.
   */
  readonly viewport: ViewportController;
}

export interface UtilityPlugin<TState extends object> {
  readonly id: UtilityId;
  /** Synchronous default state for the plugin given the loaded image. */
  init(ctx: UtilityContext): TState;
  /**
   * Mount the plugin's interactive UI under `host`. The returned handle's
   * `destroy()` is called when the editor closes.
   */
  mount(host: HTMLElement, ctx: UtilityContext, store: Store<TState>): UtilityHandle;
  /**
   * Apply this utility's transformation to the image and return the result.
   * The chain runner feeds this output as the next utility's input.
   */
  bake(state: TState, source: SourceImage): Promise<SourceImage>;
}
