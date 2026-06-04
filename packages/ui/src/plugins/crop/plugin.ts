import {
  bakeCrop,
  type CropPreset,
  type CropPresetFilter,
  type CropState,
  initialCropState,
  type UtilityPlugin,
} from '@magicpages/kalotyp-core';
import { mountCropUtility } from './mount.js';

const UTILITY_ID = 'crop';

export interface CropPluginOptions {
  /** The 12 presets Ghost passes (or any caller-supplied subset). */
  readonly presets: readonly CropPreset[];
  /** Orientation filter (Ghost always passes 'landscape'). */
  readonly presetFilter: CropPresetFilter | undefined;
  /** Panel host (closed-over); stage host is the `mount()` argument. */
  readonly panelHost: HTMLElement;
}

export function createCropPlugin(options: CropPluginOptions): UtilityPlugin<CropState> {
  return {
    id: 'crop',
    init(ctx) {
      return initialCropState({
        imageSize: { width: ctx.source.width, height: ctx.source.height },
        presets: options.presets,
        filter: options.presetFilter,
      });
    },
    mount(stageHost, ctx, store) {
      const handle = mountCropUtility({
        stageHost,
        utilHost: options.panelHost,
        source: ctx.source,
        presets: options.presets,
        presetFilter: options.presetFilter,
        store,
        viewport: ctx.viewport,
        onCommit: () => ctx.bus.emit('commit', { utility: UTILITY_ID }),
      });
      return { destroy: () => handle.destroy() };
    },
    async bake(state, source) {
      return bakeCrop(source, { rect: state.rect });
    },
  };
}
