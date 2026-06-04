import {
  bakeFlip,
  type FlipState,
  initialFlipState,
  type UtilityPlugin,
} from '@magicpages/kalotyp-core';
import { mountFlipUtility } from './mount.js';

export interface FlipPluginOptions {
  readonly panelHost: HTMLElement;
}

export function createFlipPlugin(options: FlipPluginOptions): UtilityPlugin<FlipState> {
  return {
    id: 'flip',
    init: () => initialFlipState(),
    mount(stageHost, ctx, store) {
      const handle = mountFlipUtility({
        stageHost,
        utilHost: options.panelHost,
        source: ctx.source,
        store,
        viewport: ctx.viewport,
        onCommit: () => ctx.bus.emit('commit', { utility: 'flip' }),
      });
      return { destroy: () => handle.destroy() };
    },
    bake: bakeFlip,
  };
}
