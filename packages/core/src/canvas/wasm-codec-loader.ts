/**
 * Network boundary for the WASM codec fallback (see `wasm-codec.ts`).
 * Kept in its own module so tests can stub the dynamic import without
 * hitting the network — Vitest can only intercept cross-module calls via
 * `vi.spyOn`, not a function calling itself within the same file.
 *
 * The jsDelivr `/+esm` transform is required, not optional: the packages'
 * own entry files use a bare specifier (`import ... from 'wasm-feature-detect'`)
 * that only resolves in a bundler or Node — `/+esm` rewrites that (and the
 * packages' further internal dynamic imports) into resolvable jsDelivr URLs.
 * jsDelivr explicitly discourages SRI on these `/+esm` responses (their
 * content shifts with jsDelivr's own bundler version), so the only
 * integrity guard available here is pinning exact package versions.
 */

const WEBP_CODEC_VERSION = '1.5.0';
const AVIF_CODEC_VERSION = '2.1.1';

export interface WasmEncodeModule {
  readonly default: (
    imageData: ImageData,
    options?: Record<string, unknown>,
  ) => Promise<ArrayBuffer>;
}

export function importWebpEncoder(): Promise<WasmEncodeModule> {
  return import(
    /* @vite-ignore */ `https://cdn.jsdelivr.net/npm/@jsquash/webp@${WEBP_CODEC_VERSION}/encode.js/+esm`
  );
}

export function importAvifEncoder(): Promise<WasmEncodeModule> {
  return import(
    /* @vite-ignore */ `https://cdn.jsdelivr.net/npm/@jsquash/avif@${AVIF_CODEC_VERSION}/encode.js/+esm`
  );
}
