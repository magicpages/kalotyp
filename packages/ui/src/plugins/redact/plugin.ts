import {
  bakeRedact,
  initialRedactState,
  type RedactState,
  type UtilityPlugin,
} from '@magicpages/kalotyp-core';
import { mountRedactUtility } from './mount.js';

export interface RedactPluginOptions {
  /** Where the plugin's panel UI mounts. */
  readonly panelHost: HTMLElement;
}

/**
 * Build the redact `UtilityPlugin` instance for one editor session.
 * redact is the chain link between annotate and resize;
 * `bake` is called by the chain runner with the post-annotate
 * composite as input and returns a fresh `SourceImage` with each
 * region redacted.
 */
export function createRedactPlugin(options: RedactPluginOptions): UtilityPlugin<RedactState> {
  return {
    id: 'redact',
    init: (ctx) =>
      initialRedactState({ imageSize: { width: ctx.source.width, height: ctx.source.height } }),
    mount(stageHost, ctx, store) {
      const handle = mountRedactUtility({
        stageHost,
        utilHost: options.panelHost,
        source: ctx.source,
        store,
        viewport: ctx.viewport,
        onCommit: () => ctx.bus.emit('commit', { utility: 'redact' }),
        onAnnounce: (message) => ctx.bus.emit('announce', { message }),
      });
      return { destroy: () => handle.destroy() };
    },
    bake: (state, source) => bakeRedact({ regions: state.regions }, source),
  };
}
