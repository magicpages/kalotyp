import {
  bakeFinetune,
  type FinetuneState,
  initialFinetuneState,
  type UtilityPlugin,
} from '@magicpages/kalotyp-core';
import { mountFinetuneUtility } from './mount.js';

export interface FinetunePluginOptions {
  readonly panelHost: HTMLElement;
}

export function createFinetunePlugin(options: FinetunePluginOptions): UtilityPlugin<FinetuneState> {
  return {
    id: 'finetune',
    init: () => initialFinetuneState(),
    mount(stageHost, ctx, store) {
      const handle = mountFinetuneUtility({
        stageHost,
        utilHost: options.panelHost,
        source: ctx.source,
        store,
        viewport: ctx.viewport,
        onCommit: () => ctx.bus.emit('commit', { utility: 'finetune' }),
      });
      return { destroy: () => handle.destroy() };
    },
    bake: bakeFinetune,
  };
}
