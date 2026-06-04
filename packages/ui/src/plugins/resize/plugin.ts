import {
  type ResizeState,
  type UtilityPlugin,
  bakeResize,
  initialResizeState,
} from '@magicpages/kalotyp-core';
import { mountResizeUtility } from './mount.js';

export interface ResizePluginOptions {
  readonly panelHost: HTMLElement;
}

export function createResizePlugin(options: ResizePluginOptions): UtilityPlugin<ResizeState> {
  return {
    id: 'resize',
    init: () => initialResizeState(),
    mount(stageHost, ctx, store) {
      const handle = mountResizeUtility({
        stageHost,
        utilHost: options.panelHost,
        source: ctx.source,
        store,
        viewport: ctx.viewport,
        onCommit: () => ctx.bus.emit('commit', { utility: 'resize' }),
      });
      return { destroy: () => handle.destroy() };
    },
    bake: bakeResize,
  };
}
