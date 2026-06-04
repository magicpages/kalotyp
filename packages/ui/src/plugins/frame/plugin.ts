import {
  bakeFrame,
  type FramePresetId,
  type FrameState,
  initialFrameState,
  type UtilityPlugin,
} from '@magicpages/kalotyp-core';
import { mountFrameUtility } from './mount.js';

export interface FramePluginOptions {
  /** Where the plugin's panel UI mounts. */
  readonly panelHost: HTMLElement;
  /**
   * Optional locale labels for the six presets. The Ghost adapter
   * passes Ghost's resolved `frameOptions[i][1](locale)` strings here
   * so the strip uses the user's localised labels; the playground
   * passes nothing and the strip falls back to the defaults from the
   * core preset list.
   */
  readonly labels?: Partial<Record<FramePresetId, string>> | undefined;
}

export function createFramePlugin(options: FramePluginOptions): UtilityPlugin<FrameState> {
  return {
    id: 'frame',
    init: () => initialFrameState(),
    mount(stageHost, ctx, store) {
      const handle = mountFrameUtility({
        stageHost,
        utilHost: options.panelHost,
        source: ctx.source,
        store,
        viewport: ctx.viewport,
        labels: options.labels,
        onCommit: () => ctx.bus.emit('commit', { utility: 'frame' }),
      });
      return { destroy: () => handle.destroy() };
    },
    bake: (state, source) => bakeFrame(state, source),
  };
}
