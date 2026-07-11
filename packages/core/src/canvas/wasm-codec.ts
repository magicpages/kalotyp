/**
 * WASM-codec fallback for WebP/AVIF encoding on runtimes where Canvas 2D
 * can't produce them — see `canEncodeMime` in `bake-canvas.ts`, which is
 * what decides whether this module gets used at all. This isn't a
 * Safari-only gap: as of this writing, no mainstream browser's Canvas 2D
 * implements AVIF *encoding* (AVIF *decoding* — displaying an existing AVIF
 * — has been supported broadly for years, which is a separate capability).
 * WebP encoding is the one format most evergreen browsers do support
 * natively; Safari is the notable exception there. Fetches the actual
 * encoder (libwebp / libavif, compiled to WASM) the first time it's needed
 * via `wasm-codec-loader.ts`, then reuses the loaded module for subsequent
 * encodes.
 *
 * Never bundled: this only ever reaches the network when a runtime that
 * lacks native support for the requested format actually encodes a
 * WebP/AVIF, so a runtime with native support for both never pays for it
 * (in practice: most non-Safari browsers for WebP; effectively no browser
 * for AVIF). See the "WASM codec fallback" note in AGENTS.md for why this
 * doesn't count against the zero-runtime-dependency / bundle-size rules.
 */

import type { WasmEncodeModule } from './wasm-codec-loader.js';
import * as loader from './wasm-codec-loader.js';

export type WasmEncodableMime = 'image/webp' | 'image/avif';

/** True for the mime types this module can encode when Canvas 2D can't. */
export function isWasmEncodableMime(mimeType: string): mimeType is WasmEncodableMime {
  return mimeType === 'image/webp' || mimeType === 'image/avif';
}

let webpModulePromise: Promise<WasmEncodeModule> | undefined;
let avifModulePromise: Promise<WasmEncodeModule> | undefined;

/**
 * Loads (and caches) the module for one codec. A rejected import is *not*
 * cached: a transient failure (network blip, jsDelivr hiccup) would
 * otherwise pin the module promise to that rejection forever, since `??=`
 * only skips reassignment on `null`/`undefined` — a promise that will go on
 * to reject is still non-nullish the instant it's created. Clearing the slot
 * on failure lets the next call retry a fresh import instead of permanently
 * failing until the page reloads.
 */
function loadWebpModule(): Promise<WasmEncodeModule> {
  webpModulePromise ??= loader.importWebpEncoder().catch((error: unknown) => {
    webpModulePromise = undefined;
    throw error;
  });
  return webpModulePromise;
}

function loadAvifModule(): Promise<WasmEncodeModule> {
  avifModulePromise ??= loader.importAvifEncoder().catch((error: unknown) => {
    avifModulePromise = undefined;
    throw error;
  });
  return avifModulePromise;
}

/**
 * Encode `imageData` to `mimeType` via the matching WASM codec. `quality` is
 * 0..1 (kalotyp's convention); both codecs take a 0..100 `quality` option
 * with the same "higher is better" direction, so it maps directly.
 */
export async function encodeWithWasmCodec(
  imageData: ImageData,
  mimeType: WasmEncodableMime,
  quality: number,
): Promise<Blob> {
  const codecQuality = Math.round(quality * 100);
  const modulePromise = mimeType === 'image/webp' ? loadWebpModule() : loadAvifModule();
  const { default: encode } = await modulePromise;
  const buffer = await encode(imageData, { quality: codecQuality });
  return new Blob([buffer], { type: mimeType });
}

/** Test-only: clear cached module promises between specs. */
export function resetWasmCodecCacheForTesting(): void {
  webpModulePromise = undefined;
  avifModulePromise = undefined;
}
