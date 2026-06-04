import {
  bakeRotate,
  initialRotateState,
  type RotateState,
  type UtilityPlugin,
} from '@magicpages/kalotyp-core';
import { mountRotateUtility } from './mount.js';

export interface RotatePluginOptions {
  readonly panelHost: HTMLElement;
}

export function createRotatePlugin(options: RotatePluginOptions): UtilityPlugin<RotateState> {
  return {
    id: 'rotate',
    init: () => initialRotateState(),
    mount(stageHost, ctx, store) {
      const handle = mountRotateUtility({
        stageHost,
        utilHost: options.panelHost,
        source: ctx.source,
        store,
        viewport: ctx.viewport,
        onCommit: () => ctx.bus.emit('commit', { utility: 'rotate' }),
      });
      return { destroy: () => handle.destroy() };
    },
    bake: bakeRotate,
  };
}
