import {
  DEFAULT_FINETUNE_STATE,
  type FinetuneState,
  type SourceImage,
  type UtilityPlugin,
} from '@magicpages/kalotyp-core';
import { mountFilterUtility } from './mount.js';

export interface FilterPluginOptions {
  readonly panelHost: HTMLElement;
}

/**
 * Filter plugin. Shares the finetune slot's store; `init`/`bake` here are synthetic
 * (filter isn't in CHAIN_ORDER and the editor registers the slot manually with the shared store).
 */
export function createFilterPlugin(options: FilterPluginOptions): UtilityPlugin<FinetuneState> {
  return {
    id: 'filter',
    init: () => DEFAULT_FINETUNE_STATE,
    mount(stageHost, ctx, store) {
      const handle = mountFilterUtility({
        stageHost,
        utilHost: options.panelHost,
        source: ctx.source,
        store,
        viewport: ctx.viewport,
        onCommit: () => ctx.bus.emit('commit', { utility: 'filter' }),
      });
      return { destroy: () => handle.destroy() };
    },
    bake: filterBakeIdentity,
  };
}

// Identity bake — never called, exists only to satisfy `UtilityPlugin<TState>`.
async function filterBakeIdentity(
  _state: FinetuneState,
  source: SourceImage,
): Promise<SourceImage> {
  return source;
}
