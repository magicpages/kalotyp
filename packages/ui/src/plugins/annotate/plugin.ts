import {
  type AnnotateState,
  type UtilityPlugin,
  bakeAnnotate,
  initialAnnotateState,
} from '@magicpages/kalotyp-core';
import { mountAnnotateUtility } from './mount.js';

export interface AnnotatePluginOptions {
  /**
   * Where the plugin's panel UI mounts. The plugin's stage UI is
   * mounted into the `host` argument of the standard plugin `mount()`
   * call. Same panel-host-as-closure pattern the other plugins use
   * (see `crop/plugin.ts`).
   */
  readonly panelHost: HTMLElement;
}

/**
 * Build the annotation `UtilityPlugin` instance for one editor
 * session. Each `openDefaultEditor` call gets a fresh plugin closing
 * over its own panel host.
 *
 * The chain position (annotate before resize) is the editor's
 * concern; this factory just supplies the bake.
 */
export function createAnnotatePlugin(options: AnnotatePluginOptions): UtilityPlugin<AnnotateState> {
  return {
    id: 'annotate',
    init: (ctx) =>
      initialAnnotateState({ imageSize: { width: ctx.source.width, height: ctx.source.height } }),
    mount(stageHost, ctx, store) {
      const handle = mountAnnotateUtility({
        stageHost,
        utilHost: options.panelHost,
        source: ctx.source,
        store,
        viewport: ctx.viewport,
        onCommit: () => ctx.bus.emit('commit', { utility: 'annotate' }),
        onAnnounce: (message) => ctx.bus.emit('announce', { message }),
      });
      return { destroy: () => handle.destroy() };
    },
    bake: (state, source) => bakeAnnotate({ shapes: state.shapes }, source),
  };
}
