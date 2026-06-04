import type { SourceImage, UtilityId, UtilityPlugin } from '../plugins/utility.js';

/** One link in the editor's transform pipeline, with the plugin state at Save time. */
export interface ChainLink<TState extends object = object> {
  readonly id: UtilityId;
  readonly plugin: UtilityPlugin<TState>;
  readonly state: TState;
}

/** Apply each plugin's `bake` in sequence; result of each link feeds the next. */
export async function runUtilityChain(
  links: readonly ChainLink[],
  source: SourceImage,
): Promise<SourceImage> {
  let baked = source;
  for (const link of links) {
    baked = await link.plugin.bake(link.state, baked);
  }
  return baked;
}
